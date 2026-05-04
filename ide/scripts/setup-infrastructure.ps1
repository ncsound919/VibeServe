# Nexus Alpha - Infrastructure Setup
# Run this in an ADMIN PowerShell terminal

Write-Host "=== Step 1: Enable WSL2 + Virtual Machine Platform ===" -ForegroundColor Cyan
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "=== Step 2: Set WSL2 as default ===" -ForegroundColor Cyan
wsl --set-default-version 2

Write-Host "=== Step 3: Install Ubuntu distro ===" -ForegroundColor Cyan
wsl --install -d Ubuntu

Write-Host ""
Write-Host "=== Step 4: Install Docker Desktop ===" -ForegroundColor Cyan
Write-Host "Downloading Docker Desktop..." -ForegroundColor Yellow
curl.exe -L -o "$env:TEMP\DockerDesktop.exe" "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
Start-Process -Wait -FilePath "$env:TEMP\DockerDesktop.exe" -ArgumentList "install"

Write-Host ""
Write-Host "=== REBOOT REQUIRED ===" -ForegroundColor Red
Write-Host "After reboot, launch Docker Desktop from Start Menu once."
Write-Host "Then run: docker compose -f integration/docker-compose.yml up -d" -ForegroundColor Green
