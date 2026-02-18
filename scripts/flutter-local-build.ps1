<#
PowerShell helper: add Flutter to PATH (temporary + user), verify installation,
build Flutter Web for `gallery_app`, run basic checks and optionally serve the
built site.

Usage (PowerShell):
  .\scripts\flutter-local-build.ps1 [-Serve]

Examples:
  .\scripts\flutter-local-build.ps1          # build only
  .\scripts\flutter-local-build.ps1 -Serve  # build and serve on :8080

Notes:
- Assumes Flutter SDK is at $env:USERPROFILE\develop\flutter\bin OR `flutter`
  is already on PATH.
- This script does NOT install Flutter for you.
#>
[CmdletBinding()]
param(
    [switch]$Serve
)

function Write-Ok($msg){ Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg){ Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host "[ERR]   $msg" -ForegroundColor Red }

$flutterCandidate = "$env:USERPROFILE\develop\flutter\bin"
if (Test-Path "$flutterCandidate\flutter.bat") {
    Write-Host "Temporarily adding Flutter from: $flutterCandidate"
    $env:Path = "$flutterCandidate;$env:Path"
}

# Verify flutter available
try {
    $version = & flutter --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "flutter not runnable" }
    Write-Ok "Flutter found"
    Write-Host $version
} catch {
    Write-Err "Flutter command not found. Please ensure Flutter SDK is installed and PATH contains flutter.exe/flutter.bat."
    exit 1
}

# Show doctor summary
Write-Host "Running: flutter doctor -v"
& flutter doctor -v

# Build gallery_app web
$projectDir = Join-Path $PSScriptRoot "..\gallery_app"
Push-Location $projectDir
try {
    Write-Host "Running: flutter pub get"
    & flutter pub get

    Write-Host "Running: flutter clean"
    & flutter clean

    Write-Host "Running: flutter build web --release"
    & flutter build web --release
    if ($LASTEXITCODE -ne 0) { throw "flutter build failed" }
    Write-Ok "Flutter web build completed — output: $projectDir\build\web"
} catch {
    Write-Err "Build failed: $_"
    Pop-Location
    exit 1
}

# Quick verification: ensure no 'photo_clicks' references remain in build output
$buildWeb = Join-Path $projectDir 'build\web'
Write-Host "Searching build output for 'photo_clicks'..."
$matches = Select-String -Path "$buildWeb\**\*" -Pattern "photo_clicks" -SimpleMatch -ErrorAction SilentlyContinue
if ($matches) {
    Write-Warn "Found 'photo_clicks' in built files (should be disabled). Review occurrences:"
    $matches | Select-Object Path,LineNumber,Line | Format-Table -AutoSize
} else {
    Write-Ok "No 'photo_clicks' references found in build output."
}

Pop-Location

if ($Serve) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        Push-Location $buildWeb
        Write-Ok "Starting static server on http://localhost:8080 — press Ctrl+C to stop"
        python -m http.server 8080
        Pop-Location
    } else {
        Write-Warn "Python not found — cannot serve build locally. Serve the files using any static server." 
    }
}

Write-Ok "Script finished. If build succeeded, open http://localhost:8080 after starting a server in gallery_app\build\web."
