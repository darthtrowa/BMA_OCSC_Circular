# ==============================================================================
# Script: sync-db.ps1
# Description: Syncs PostgreSQL database from Local (port 5432) to Docker (port 5433)
# ==============================================================================

$LocalUser = "postgres"
$LocalPass = "MKhNYeMDtZ4nuUCy"
$LocalDb = "circular"
$LocalPort = 5432

$DockerUser = "admin"
$DockerPass = "MKhNYeMDtZ4nuUCy"
$DockerDb = "circular_db"
$DockerPort = 5433

$BackupFile = "docs\sync_temp.sql"

Write-Host "=== BMA Circular - Database Sync ===" -ForegroundColor Cyan
Write-Host "This script will OVERWRITE the Docker database ($DockerDb) with data from Local ($LocalDb)." -ForegroundColor Yellow
Write-Host ""

# 1. Export Data from Local DB
Write-Host "[1/2] Exporting data from Local Database (Port $LocalPort)..." -ForegroundColor Green
$env:PGPASSWORD = $LocalPass
& pg_dump -U $LocalUser -h localhost -p $LocalPort --clean --if-exists $LocalDb > $BackupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to export data. Please check if PostgreSQL is running on port $LocalPort." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Export successful. Temporary file created at $BackupFile" -ForegroundColor Green

# 2. Import Data to Docker DB
Write-Host "[2/2] Importing data into Docker Database (Port $DockerPort)..." -ForegroundColor Green
$env:PGPASSWORD = $DockerPass
& psql -U $DockerUser -h localhost -p $DockerPort -d $DockerDb -f $BackupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to import data. Please check if Docker is running and mapped to port $DockerPort." -ForegroundColor Red
    exit 1
}

# 3. Cleanup
Remove-Item $BackupFile -ErrorAction SilentlyContinue
$env:PGPASSWORD = ""

Write-Host ""
Write-Host "🎉 Database Sync Completed Successfully!" -ForegroundColor Green
