$ErrorActionPreference = "SilentlyContinue"
$base = if ($env:MESSMATE_BASE_URL) { $env:MESSMATE_BASE_URL } else { "http://localhost:3000" }

function Get-Env($key) {
  $raw = (Get-Content .env | Select-String "^$key=" | ForEach-Object { $_.Line -replace "^$key=", '' }) -join ''
  return $raw.Trim().Trim('"').Trim("'")
}

function Login {
  param($provider, $email, $password, $callbackUrl)
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $csrf = (Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60).Content | ConvertFrom-Json | Select-Object -ExpandProperty csrfToken
  $body = @{ email = $email; password = $password; csrfToken = $csrf; callbackUrl = $callbackUrl }
  Invoke-WebRequest -Uri "$base/api/auth/callback/$provider" -Method POST -Body $body -WebSession $s -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60 | Out-Null
  return $s
}

function Probe {
  param($label, $sess, $path)
  try {
    $r = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -WebSession $sess -MaximumRedirection 0 -TimeoutSec 60
    $code = $r.StatusCode; $loc = $r.Headers['Location']
  } catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode; $loc = $_.Exception.Response.Headers['Location'] }
    else { Write-Output "  [$label] $path -> EXC $($_.Exception.Message)"; return }
  }
  $locText = if ($loc) { " -> $loc" } else { "" }
  Write-Output "  [$label] $path = $code$locText"
}

$owner = Login "credentials" "e2e-probe@test.local" "Probe12345" "$base/dashboard"
$admin = Login "superadmin"  (Get-Env "SUPER_ADMIN_EMAIL") (Get-Env "SUPER_ADMIN_PASSWORD") "$base/admin"

Write-Output "== anonymous =="
$anon = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Probe "anon" $anon "/dashboard"
Probe "anon" $anon "/admin"
Probe "anon" $anon "/"
# An unknown URL must reach the app-wide 404, not be redirected to the login
# form. The proxy used to swallow every unlisted path, which turned every
# mistyped link into a sign-in prompt and hid 404s from crawlers.
Probe "anon" $anon "/no-such-page"
Probe "owner" $owner "/no-such-page"

Write-Output "== owner session =="
Probe "owner" $owner "/dashboard"
Probe "owner" $owner "/admin"
Probe "owner" $owner "/"
Probe "owner" $owner "/login"
Probe "owner" $owner "/signup"

Write-Output "== admin session =="
Probe "admin" $admin "/admin"
Probe "admin" $admin "/dashboard"
Probe "admin" $admin "/"
Probe "admin" $admin "/login"
