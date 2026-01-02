# Database Reset Script
# This script clears all data from the database tables while preserving the schema

Write-Host "⚠️  WARNING: This will delete ALL data from your database!" -ForegroundColor Red
Write-Host "Press Ctrl+C to cancel, or any other key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`n🗑️  Clearing database..." -ForegroundColor Cyan

# Get the connection string from .env.local
$envFile = Get-Content .env.local
$directUrl = ($envFile | Select-String "DIRECT_URL=").ToString().Replace("DIRECT_URL=", "").Trim('"')

if (-not $directUrl) {
    Write-Host "❌ DIRECT_URL not found in .env.local" -ForegroundColor Red
    exit 1
}

# SQL to truncate all tables (in correct order to respect foreign keys)
$sql = @"
-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Clear all tables
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE user_preferences CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';
"@

# Execute the SQL
try {
    # Save SQL to temp file
    $tempFile = [System.IO.Path]::GetTempFileName()
    $sql | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Execute with psql
    $env:PGPASSWORD = ($directUrl -replace '.*:([^@]+)@.*', '$1')
    $host = ($directUrl -replace '.*@([^:]+):.*', '$1')
    $port = ($directUrl -replace '.*:(\d+)/.*', '$1')
    $database = ($directUrl -replace '.*/([^?]+).*', '$1')
    $user = ($directUrl -replace '.*://([^:]+):.*', '$1')
    
    psql -h $host -p $port -U $user -d $database -f $tempFile
    
    Remove-Item $tempFile -Force
    
    Write-Host "✅ Database cleared successfully!" -ForegroundColor Green
    Write-Host "📊 All tables are now empty but schema is intact." -ForegroundColor Green
} catch {
    Write-Host "❌ Error clearing database: $_" -ForegroundColor Red
    Write-Host "💡 Make sure you have psql installed and accessible in PATH" -ForegroundColor Yellow
    Write-Host "💡 Alternative: Run the SQL commands manually in Supabase SQL Editor" -ForegroundColor Yellow
    exit 1
}
