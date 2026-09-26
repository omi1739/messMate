param(
  [Parameter(Position = 0)][string]$target = "/dashboard",
  [Parameter(Position = 1)][string]$grep = "",
  [Parameter(Position = 2)][ValidateSet("owner", "admin")][string]$as = "owner"
)

$ErrorActionPreference = "SilentlyContinue"
$base = if ($env:MESSMATE_BASE) { $env:MESSMATE_BASE } else { "http://localhost:3000" }

if ($as -eq "admin") {
  # The admin password is never stored in the repo; it is read from the same
  # .env the app itself uses. Values there may be quoted, so strip them.
  function Read-Env {
    param($name)
    $line = (Get-Content "$PSScriptRoot\..\.env" | Where-Object { $_ -match "^$name=" } | Select-Object -First 1)
    if (-not $line) { return $null }
    return (($line -replace "^$name=", "").Trim().Trim('"').Trim("'"))
  }

  $password = Read-Env "SUPER_ADMIN_PASSWORD"
  $email = Read-Env "SUPER_ADMIN_EMAIL"
  if (-not $password -or -not $email) {
    Write-Output "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set in .env"
    exit 1
  }
  $provider = "superadmin"
  $callback = "$base/admin"
} else {
  $email = "e2e-probe@test.local"
  $password = "Probe12345"
  $provider = "credentials"
  $callback = "$base/dashboard"
}

function Login {
  param($provider, $email, $password, $callbackUrl)
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $csrf = (Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60).Content | ConvertFrom-Json | Select-Object -ExpandProperty csrfToken
  $body = @{ email = $email; password = $password; csrfToken = $csrf; callbackUrl = $callbackUrl }
  Invoke-WebRequest -Uri "$base/api/auth/callback/$provider" -Method POST -Body $body -WebSession $s -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60 | Out-Null
  return $s
}

$s = Login $provider $email $password $callback
$r = Invoke-WebRequest -Uri "$base$target" -UseBasicParsing -WebSession $s -TimeoutSec 120

Write-Output "GET $target [$as] -> $($r.StatusCode)  ($($r.RawContentLength) bytes)"
$html = $r.Content

# Strip tags so assertions read the visible text, not the markup.
$text = $html -replace '<script[\s\S]*?</script>', ' ' -replace '<style[\s\S]*?</style>', ' ' -replace '<[^>]+>', ' ' -replace '&nbsp;', ' ' -replace '&amp;', '&' -replace '\s+', ' '

if ($grep -ne "") {
  if ($text -match [regex]::Escape($grep)) {
    Write-Output "FOUND: '$grep'"
  } else {
    Write-Output "MISSING: '$grep'"
  }
} else {
  Write-Output ""
  Write-Output ($text.Substring(0, [Math]::Min(2600, $text.Length)))
}
