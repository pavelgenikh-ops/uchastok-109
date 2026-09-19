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

$exportDir = [char]0x044D + [char]0x043A + [char]0x0441 + [char]0x043F + [char]0x043E + [char]0x0440 + [char]0x0442
Get-ChildItem -Path $src -Force | ForEach-Object {
  $n = $_.Name
  if ($n -eq $exportDir -or $n -eq 'tmp' -or $n -eq 'node_modules') { return }
  if ($n -like '*.log' -or $n -like '*.err' -or $n -like '*.zip' -or $n -eq '.port') { return }
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
