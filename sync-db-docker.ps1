# ==============================================================================
# Script: sync-db-docker.ps1
# Description: Syncs Database from Local to Docker using Docker's internal tools
# ==============================================================================

$LocalUser = "postgres"
$LocalPass = "1956wine"
$LocalDb = "circular"
$LocalPort = 5432

$DockerUser = "admin"
$DockerPass = "MKhNYeMDtZ4nuUCy"
$DockerDb = "circular_db"

$BackupFile = "docs\sync_temp.sql"

Write-Host "=== BMA Circular - Database Sync (Docker Version) ===" -ForegroundColor Cyan
Write-Host "This script will OVERWRITE the Docker database ($DockerDb) with data from Local ($LocalDb)." -ForegroundColor Yellow
Write-Host "Please ensure Docker Desktop is RUNNING and 'docker compose up -d' has been executed." -ForegroundColor Yellow
Write-Host ""

# 1. Export Data from Local DB using the Docker container
Write-Host "[1/2] Exporting data from Local Database (Port $LocalPort) using postgres:18 container..." -ForegroundColor Green
# We use 'host.docker.internal' so the container can reach the host machine's port 5432
cmd.exe /c "docker run --rm -e PGPASSWORD=$LocalPass postgres:18-alpine pg_dump -U $LocalUser -h host.docker.internal -p $LocalPort --clean --if-exists $LocalDb > $BackupFile"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to export data. Please check if PostgreSQL is running on port $LocalPort and Docker is running." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Export successful. Temporary file created at $BackupFile" -ForegroundColor Green

# 2. Import Data to Docker DB
Write-Host "[2/2] Importing data into Docker Database ($DockerDb)..." -ForegroundColor Green
cmd.exe /c "docker exec -i -e PGPASSWORD=$DockerPass bma_ocsc_circular-db-1 psql -U $DockerUser -d $DockerDb < $BackupFile"

if ($LASTEXITCODE -ne 0) {
    cmd.exe /c "docker exec -i -e PGPASSWORD=$DockerPass db psql -U $DockerUser -d $DockerDb < $BackupFile"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to import data." -ForegroundColor Red
    exit 1
}

# 3. Cleanup
Remove-Item $BackupFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🎉 Database Sync Completed Successfully!" -ForegroundColor Green
