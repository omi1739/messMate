$ErrorActionPreference = "SilentlyContinue"
$base = "http://localhost:3000"
$email = "e2e-probe@test.local"
$password = "Probe12345"

function Login {
  param($provider, $email, $password, $callbackUrl)
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $csrf = (Invoke-WebRequest -Uri "$base/api/auth/csrf" -UseBasicParsing -WebSession $s -TimeoutSec 60).Content | ConvertFrom-Json | Select-Object -ExpandProperty csrfToken
  $body = @{ email = $email; password = $password; csrfToken = $csrf; callbackUrl = $callbackUrl }
  Invoke-WebRequest -Uri "$base/api/auth/callback/$provider" -Method POST -Body $body -WebSession $s -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60 | Out-Null
  return $s
}

$target = if ($args.Count -gt 0) { $args[0] } else { "/dashboard" }
$grep = if ($args.Count -gt 1) { $args[1] } else { "" }

$s = Login "credentials" $email $password "$base/dashboard"
$r = Invoke-WebRequest -Uri "$base$target" -UseBasicParsing -WebSession $s -TimeoutSec 120

Write-Output "GET $target -> $($r.StatusCode)  ($($r.RawContentLength) bytes)"
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
