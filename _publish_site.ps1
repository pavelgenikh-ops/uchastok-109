# Prepares the "site" folder for GitHub Pages and stamps the build version.
# ASCII only inside: PowerShell 5.1 reads .ps1 as ANSI and breaks on Cyrillic.
$ErrorActionPreference = 'Stop'
$src  = Split-Path -Parent $MyInvocation.MyCommand.Path
$site = Join-Path $src 'docs'

if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory -Path $site | Out-Null

# what the browser actually needs
foreach ($item in @('index.html', 'js', 'lib', 'utils', 'data', 'models')) {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item $p -Destination $site -Recurse -Force }
}
$cand = Join-Path $site 'models\candidates'
if (Test-Path $cand) { Remove-Item $cand -Recurse -Force }

# QR to the published address: handed to the customer and kept reachable at /qr.png.
# The folder name is Cyrillic ("peredacha"), built from codes - this file stays ASCII-only.
function U([int[]]$c) { -join ($c | ForEach-Object { [char]$_ }) }
$peredacha = U 0x043F,0x0435,0x0440,0x0435,0x0434,0x0430,0x0447,0x0430
$qr = Join-Path (Join-Path (Split-Path -Parent $src) $peredacha) 'qr.png'
if (Test-Path $qr) { Copy-Item $qr -Destination (Join-Path $site 'qr.png') -Force }

# Portable archive under a FIXED name: the link in the customer letter points
# here. The docs folder is rebuilt from scratch every time, so without this
# copy the download link starts answering 404.
$zip = Get-ChildItem (Split-Path -Parent $src) -Filter 'Landshaft-3D-portable-*.zip' |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($zip) { Copy-Item $zip.FullName -Destination (Join-Path $site 'Landshaft-3D-portable.zip') -Force }

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
Write-Host ('Docs folder ready: ' + $site)
Write-Host ('Size: ' + $mb + ' MB   Build: ' + $stamp)
Write-Host 'Next: git add -A && git commit -m "update" && git push'
