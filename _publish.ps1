# Prepares the "site" folder for GitHub Pages and stamps the build version.
# ASCII only inside: PowerShell 5.1 reads .ps1 as ANSI and breaks on Cyrillic.
$ErrorActionPreference = 'Stop'
$src  = Split-Path -Parent $MyInvocation.MyCommand.Path
$site = Join-Path $src 'site'

if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory -Path $site | Out-Null

# what the browser actually needs
foreach ($item in @('index.html', 'js', 'lib', 'utils', 'data', 'models')) {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item $p -Destination $site -Recurse -Force }
}
$cand = Join-Path $site 'models\candidates'
if (Test-Path $cand) { Remove-Item $cand -Recurse -Force }

# build stamp: on Pages there is no server to send the X-Build header
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$idx = Join-Path $site 'index.html'
$html = Get-Content $idx -Raw -Encoding UTF8
$html = $html -replace '<span id="build">[^<]*</span>', ('<span id="build">' + $stamp + '</span>')
# Jekyll must not touch the files
Set-Content -Path (Join-Path $site '.nojekyll') -Value '' -NoNewline
Set-Content -Path $idx -Value $html -Encoding UTF8

$mb = [math]::Round(((Get-ChildItem $site -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host ''
Write-Host ('Site folder ready: ' + $site)
Write-Host ('Size: ' + $mb + ' MB   Build: ' + $stamp)
Write-Host 'Next: git add site && git commit && git push'
