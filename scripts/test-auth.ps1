$ErrorActionPreference = "Continue"
$base = if ($env:MESSMATE_BASE_URL) { $env:MESSMATE_BASE_URL } else { "http://localhost:3000" }
$script:failures = 0

function Add-Failure {
  param($label, $detail)
  $script:failures++
  Write-Output "  FAIL [$label] $detail"
}

# A rejected login and an accepted one are told apart by the error the callback
# redirects with, so the expected verdict is checked against the redirect
# itself rather than against the absence of an exception. An accepted login has
# to set a session cookie as well, otherwise "accepted" would only mean the
# form handler did not complain.
function Test-Login {
  param($label, $provider, $email, $password, $callbackUrl, $expect, $expectPath)

  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $csrfResp = Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60
    $csrf = ($csrfResp.Content | ConvertFrom-Json).csrfToken
  } catch {
    Write-Output "[$label] CSRF FAILED: $($_.Exception.Message)"
    Add-Failure $label "could not fetch a CSRF token: $($_.Exception.Message)"
    return
  }

  $body = @{ email = $email; password = $password; csrfToken = $csrf; callbackUrl = $callbackUrl }
  $code = 0
  $loc = ""
  try {
    $r = Invoke-WebRequest -Uri "$base/api/auth/callback/$provider" -Method POST -Body $body -WebSession $s -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60
    $code = $r.StatusCode
    $loc = $r.Headers['Location']
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      $loc = $_.Exception.Response.Headers['Location']
    } else {
      Write-Output "[$label] ERROR: $($_.Exception.Message)"
      Add-Failure $label "request failed: $($_.Exception.Message)"
      return
    }
  }

  $verdict = if ($loc -match "error=") { "REJECTED" } else { "ACCEPTED" }
  Write-Output "[$label] $verdict  $code -> $loc"

  if ($verdict -ne $expect) {
    Add-Failure $label "expected $expect but the callback returned $verdict"
    return
  }

  if ($expect -eq "ACCEPTED") {
    if ($loc -notlike "*$expectPath*") {
      Add-Failure $label "accepted but redirected to '$loc' instead of '$expectPath'"
    }
    $hasCookie = $false
    try {
      foreach ($c in $s.Cookies.GetCookies($base)) {
        if ($c.Name -like "*authjs.session-token*") { $hasCookie = $true }
      }
    } catch { }
    if (-not $hasCookie) { Add-Failure $label "accepted but no session cookie was set" }
  }
}

$adminEmail = ((Get-Content .env | Select-String '^SUPER_ADMIN_EMAIL=' | ForEach-Object { $_.Line -replace '^SUPER_ADMIN_EMAIL=', '' }) -join '').Trim().Trim('"').Trim("'")
$adminPass  = ((Get-Content .env | Select-String '^SUPER_ADMIN_PASSWORD=' | ForEach-Object { $_.Line -replace '^SUPER_ADMIN_PASSWORD=', '' }) -join '').Trim().Trim('"').Trim("'")
Write-Output "admin email loaded: '$adminEmail' (len $($adminEmail.Length)), password len $($adminPass.Length)"
Write-Output ""

# The two providers are separate on purpose, so an owner's own valid
# credentials must be refused by the superadmin provider. That case is the
# whole reason the two exist, so it is asserted rather than printed.
Test-Login "owner-ok           " "credentials" "e2e-probe@test.local" "Probe12345" "$base/dashboard"  "ACCEPTED" "/dashboard"
Test-Login "owner-bad-password " "credentials" "e2e-probe@test.local" "WrongPass123" "$base/dashboard" "REJECTED" ""
Test-Login "owner-unknown-user " "credentials" "nobody@test.local"     "Probe12345" "$base/dashboard" "REJECTED" ""
Test-Login "admin-ok           " "superadmin"  $adminEmail              $adminPass  "$base/admin"     "ACCEPTED" "/admin"
Test-Login "admin-wrong-pass   " "superadmin"  $adminEmail              "nope123"    "$base/admin"     "REJECTED" ""
Test-Login "admin-owner-creds  " "superadmin"  "e2e-probe@test.local"  "Probe12345" "$base/admin"     "REJECTED" ""

Write-Output ""
if ($script:failures -eq 0) {
  Write-Output "PASS: 6 credential cases, each accepted or refused as required"
  exit 0
}
Write-Output "FAIL: $script:failures unexpected result(s)"
exit 1
