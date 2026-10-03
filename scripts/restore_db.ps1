# ============================================================================
# Restauration de la base de données DPP Assistant
# ============================================================================
#
# Usage :
#     .\scripts\restore_db.ps1 -BackupFile "backups\dpp_2026-09-22_20-00-00.sql.gz"
#
# ATTENTION : écrase les données existantes.
#
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

# --- Configuration ---
$MySQLBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$DBUser = "root"
$DBPassword = "DppRoot2026!"
$DBName = "dpp_assistant"
$DBPort = "3307"
$DBHost = "127.0.0.1"

# --- Résolution du chemin ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

if (-not [System.IO.Path]::IsPathRooted($BackupFile)) {
    $BackupFile = Join-Path $ProjectRoot $BackupFile
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "Fichier introuvable : $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "AVERTISSEMENT : cette opération va écraser la base '$DBName'." -ForegroundColor Yellow
$Confirmation = Read-Host "Tapez 'OUI' pour confirmer"

if ($Confirmation -ne "OUI") {
    Write-Host "Annulé." -ForegroundColor Yellow
    exit 0
}

# --- Décompression ---
$TempSql = [System.IO.Path]::GetTempFileName() + ".sql"
Write-Host "Décompression..." -ForegroundColor Cyan

$input = [System.IO.File]::OpenRead($BackupFile)
$gzip = New-Object System.IO.Compression.GZipStream($input, [System.IO.Compression.CompressionMode]::Decompress)
$output = [System.IO.File]::Create($TempSql)
$gzip.CopyTo($output)
$output.Close()
$gzip.Close()
$input.Close()

# --- Restauration ---
Write-Host "Restauration dans '$DBName'..." -ForegroundColor Cyan

$mysql = Join-Path $MySQLBin "mysql.exe"

Get-Content $TempSql | & $mysql `
    --user=$DBUser `
    --password=$DBPassword `
    --host=$DBHost `
    --port=$DBPort `
    $DBName

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la restauration." -ForegroundColor Red
    Remove-Item $TempSql -Force
    exit 1
}

Remove-Item $TempSql -Force

Write-Host "Restauration réussie." -ForegroundColor Green