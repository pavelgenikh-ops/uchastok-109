# Packs the app into a portable ZIP next to the project folder.
# ASCII only inside: PowerShell 5.1 reads .ps1 as ANSI and breaks on Cyrillic.
# IMPORTANT: names are written in UTF-8. Compress-Archive writes them in OEM,
# and then Cyrillic file names (START.bat etc.) come out as garbage on unpack.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src  = Split-Path -Parent $MyInvocation.MyCommand.Path
$name = 'Landshaft-3D-portable-' + (Get-Date -Format 'yyyy-MM-dd')
$tmp  = Join-Path $env:TEMP $name
$zip  = Join-Path (Split-Path -Parent $src) ($name + '.zip')

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

# Cyrillic names are built from codes: this file must stay ASCII-only.
function U([int[]]$c) { -join ($c | ForEach-Object { [char]$_ }) }
$exportDir = U 0x044D,0x043A,0x0441,0x043F,0x043E,0x0440,0x0442   # eksport
$pub       = U 0x041F,0x0423,0x0411,0x041B,0x0418,0x041A,0x0410,0x0426,0x0418,0x042F  # PUBLIKACIYA
# NB: inside @( ... ) a "(U ...) + '.bat'" expression splits into two elements,
# so every Cyrillic name is assembled in its own variable first.
$arhiv   = (U 0x0410,0x0420,0x0425,0x0418,0x0412) + '.bat'    # ARHIV.bat
$pubBat  = $pub + '.bat'
$pubMd   = $pub + '.md'
$prochti = (U 0x041F,0x0420,0x041E,0x0427,0x0422,0x0418) + '.md'  # PROCHTI.md
$skip = @(
  $exportDir, 'tmp', 'node_modules', '.git', '.claude', 'docs', '.port',
  'build-site.js', '_arhiv.ps1', '_publish_site.ps1',
  $arhiv, $pubBat, $pubMd, $prochti
)
Get-ChildItem -Path $src -Force | ForEach-Object {
  $n = $_.Name
  if ($skip -contains $n) { return }
  if ($n -like '*.log' -or $n -like '*.err' -or $n -like '*.zip' -or $n -like '*.mjs') { return }
  Copy-Item $_.FullName -Destination $tmp -Recurse -Force
}
$cand = Join-Path $tmp 'models\candidates'
if (Test-Path $cand) { Remove-Item $cand -Recurse -Force }

if (Test-Path $zip) { Remove-Item $zip -Force }
[IO.Compression.ZipFile]::CreateFromDirectory(
  $tmp, $zip, [IO.Compression.CompressionLevel]::Optimal, $false, [Text.Encoding]::UTF8)
Remove-Item $tmp -Recurse -Force

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ''
Write-Host ('ZIP ready: ' + $zip)
Write-Host ('Size: ' + $mb + ' MB')
Write-Host 'Unpack anywhere and run START.bat'
