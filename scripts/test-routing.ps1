$ErrorActionPreference = "SilentlyContinue"
$base = if ($env:MESSMATE_BASE_URL) { $env:MESSMATE_BASE_URL } else { "http://localhost:3000" }
$script:failures = 0

function Add-Failure {
  param($label, $detail)
  $script:failures++
  Write-Output "  FAIL [$label] $detail"
}

function Get-Env($key) {
  $raw = (Get-Content .env | Select-String "^$key=" | ForEach-Object { $_.Line -replace "^$key=", '' }) -join ''
  return $raw.Trim().Trim('"').Trim("'")
}

# A session that failed to log in would turn every later probe into a redirect
# and the table below would still look like a set of redirects. So the cookie
# is checked here, once, and the probes then trust the session.
function Login {
  param($label, $provider, $email, $password, $callbackUrl)
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $csrf = (Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60).Content | ConvertFrom-Json | Select-Object -ExpandProperty csrfToken
  $body = @{ email = $email; password = $password; csrfToken = $csrf; callbackUrl = $callbackUrl }
  Invoke-WebRequest -Uri "$base/api/auth/callback/$provider" -Method POST -Body $body -WebSession $s -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60 | Out-Null

  $hasCookie = $false
  try {
    foreach ($c in $s.Cookies.GetCookies($base)) {
      if ($c.Name -like "*authjs.session-token*") { $hasCookie = $true }
    }
  } catch { }
  if (-not $hasCookie) { $null = Add-Failure $label "login produced no session cookie" }
  return $s
}

# $expectCode is either an exact status or "3xx", because Next.js is free to
# answer a redirect with 307 or 308 and a table that pinned 307 would report a
# failure whenever that changed. $expectPath is the destination the redirect
# must carry, so "redirects somewhere" cannot pass as "redirects to login".
function Probe {
  param($label, $sess, $path, $expectCode, $expectPath)
  try {
    $r = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -WebSession $sess -MaximumRedirection 0 -TimeoutSec 60
    $code = $r.StatusCode; $loc = $r.Headers['Location']
  } catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode; $loc = $_.Exception.Response.Headers['Location'] }
    else { Write-Output "  [$label] $path -> EXC $($_.Exception.Message)"; Add-Failure $label "$path could not be requested: $($_.Exception.Message)"; return }
  }
  $locText = if ($loc) { " -> $loc" } else { "" }
  Write-Output "  [$label] $path = $code$locText"

  $codeOk = if ($expectCode -eq "3xx") { $code -ge 300 -and $code -lt 400 } else { $code -eq [int]$expectCode }
  if (-not $codeOk) { Add-Failure $label "$path returned $code, expected $expectCode" }

  if ($expectPath) {
    if (-not $loc) { Add-Failure $label "$path did not redirect to $expectPath" }
    elseif ($loc -notlike "*$expectPath*") { Add-Failure $label "$path redirected to '$loc', expected '$expectPath'" }
  } elseif ($loc) {
    Add-Failure $label "$path answered $code but also sent a redirect to '$loc'"
  }
}

$owner = Login "owner" "credentials" "e2e-probe@test.local" "Probe12345" "$base/dashboard"
$admin = Login "admin" "superadmin"  (Get-Env "SUPER_ADMIN_EMAIL") (Get-Env "SUPER_ADMIN_PASSWORD") "$base/admin"

Write-Output "== anonymous =="
$anon = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Probe "anon" $anon "/dashboard" "3xx" "/login"
Probe "anon" $anon "/admin" "3xx" "/admin-login"
Probe "anon" $anon "/" "200" ""
# An unknown URL must reach the app-wide 404, not be redirected to the login
# form. The proxy used to swallow every unlisted path, which turned every
# mistyped link into a sign-in prompt and hid 404s from crawlers.
Probe "anon" $anon "/no-such-page" "404" ""
Probe "owner" $owner "/no-such-page" "404" ""

Write-Output "== owner session =="
Probe "owner" $owner "/dashboard" "200" ""
Probe "owner" $owner "/admin" "3xx" "/admin-login"
Probe "owner" $owner "/" "3xx" "/dashboard"
Probe "owner" $owner "/login" "3xx" "/dashboard"
Probe "owner" $owner "/signup" "3xx" "/dashboard"

Write-Output "== admin session =="
Probe "admin" $admin "/admin" "200" ""
Probe "admin" $admin "/dashboard" "3xx" "/admin"
Probe "admin" $admin "/" "3xx" "/admin"
Probe "admin" $admin "/login" "3xx" "/admin"

Write-Output ""
if ($script:failures -eq 0) {
  Write-Output "PASS: 14 routes, each answering as its session requires"
  exit 0
}
Write-Output "FAIL: $script:failures unexpected result(s)"
exit 1
