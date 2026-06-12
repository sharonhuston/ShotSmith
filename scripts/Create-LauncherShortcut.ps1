# Creates "Launch ShotSmith.lnk" with ShotSmith.ico (Windows .bat files cannot embed icons).
$root = Split-Path $PSScriptRoot -Parent
$bat = Join-Path $root 'Launch ShotSmith.bat'
$ico = Join-Path $root 'ShotSmith.ico'
$lnk = Join-Path $root 'Launch ShotSmith.lnk'

if (-not (Test-Path -LiteralPath $bat)) {
  Write-Error "Missing Launch ShotSmith.bat in $root"
  exit 1
}
if (-not (Test-Path -LiteralPath $ico)) {
  Write-Error "Missing ShotSmith.ico in $root"
  exit 1
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$ico,0"
$shortcut.Description = 'Start ShotSmith (npm run dev)'
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Shortcut created: $lnk"
Write-Host "Use _local\Launch ShotSmith.lnk in Explorer for the custom icon; it runs Launch ShotSmith.bat."
