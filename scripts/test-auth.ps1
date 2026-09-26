$ErrorActionPreference = "Continue"
$base = "http://localhost:3000"

function Test-Login {
  param($label, $provider, $email, $password, $callbackUrl)

  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $csrfResp = Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60
    $csrf = ($csrfResp.Content | ConvertFrom-Json).csrfToken
  } catch {
    Write-Output "[$label] CSRF FAILED: $($_.Exception.Message)"
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
      return
    }
  }

  $verdict = if ($loc -match "error=") { "REJECTED" } else { "ACCEPTED" }
  Write-Output "[$label] $verdict  $code -> $loc"
}

$adminEmail = ((Get-Content .env | Select-String '^SUPER_ADMIN_EMAIL=' | ForEach-Object { $_.Line -replace '^SUPER_ADMIN_EMAIL=', '' }) -join '').Trim().Trim('"').Trim("'")
$adminPass  = ((Get-Content .env | Select-String '^SUPER_ADMIN_PASSWORD=' | ForEach-Object { $_.Line -replace '^SUPER_ADMIN_PASSWORD=', '' }) -join '').Trim().Trim('"').Trim("'")
Write-Output "admin email loaded: '$adminEmail' (len $($adminEmail.Length)), password len $($adminPass.Length)"
Write-Output ""

Test-Login "owner-ok           " "credentials" "e2e-probe@test.local" "Probe12345" "$base/dashboard"
Test-Login "owner-bad-password " "credentials" "e2e-probe@test.local" "WrongPass123" "$base/dashboard"
Test-Login "owner-unknown-user " "credentials" "nobody@test.local"     "Probe12345" "$base/dashboard"
Test-Login "admin-ok           " "superadmin"  $adminEmail              $adminPass  "$base/admin"
Test-Login "admin-wrong-pass   " "superadmin"  $adminEmail              "nope123"    "$base/admin"
Test-Login "admin-owner-creds  " "superadmin"  "e2e-probe@test.local"  "Probe12345" "$base/admin"
