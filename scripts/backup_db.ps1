# ============================================================================
# Sauvegarde de la base de données DPP Assistant
# ============================================================================
#
# Usage :
#     .\scripts\backup_db.ps1
#
# Crée un fichier .sql.gz horodaté dans backups/
# Supprime automatiquement les sauvegardes de plus de 30 jours.
#
# ============================================================================

# --- Configuration ---
$MySQLBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$DBUser = "root"
$DBPassword = "DppRoot2026!"
$DBName = "dpp_assistant"
$DBPort = "3308"
$DBHost = "127.0.0.1"

# --- Dossier de sauvegardes ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# --- Nom du fichier de sauvegarde ---
$Date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupDir "dpp_$Date.sql"

# --- Exécution de mysqldump ---
Write-Host "Sauvegarde de la base '$DBName'..." -ForegroundColor Cyan

$mysqldump = Join-Path $MySQLBin "mysqldump.exe"

& $mysqldump `
    --user=$DBUser `
    --password=$DBPassword `
    --host=$DBHost `
    --port=$DBPort `
    --single-transaction `
    --routines `
    --triggers `
    $DBName > $BackupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la sauvegarde." -ForegroundColor Red
    exit 1
}

# --- Compresser ---
$CompressedFile = "$BackupFile.gz"
$input = [System.IO.File]::OpenRead($BackupFile)
$output = [System.IO.File]::Create($CompressedFile)
$gzip = New-Object System.IO.Compression.GZipStream($output, [System.IO.Compression.CompressionLevel]::Optimal)
$input.CopyTo($gzip)
$gzip.Close()
$output.Close()
$input.Close()
Remove-Item $BackupFile

$SizeMb = [math]::Round((Get-Item $CompressedFile).Length / 1MB, 2)

Write-Host "Sauvegarde réussie : $CompressedFile ($SizeMb Mo)" -ForegroundColor Green

# --- Nettoyage des sauvegardes > 30 jours ---
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "dpp_*.sql.gz" |
              Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }

if ($OldBackups.Count -gt 0) {
    Write-Host "Suppression de $($OldBackups.Count) ancienne(s) sauvegarde(s)..." -ForegroundColor Yellow
    $OldBackups | Remove-Item -Force
}

Write-Host "Terminé." -ForegroundColor Cyan