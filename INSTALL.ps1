# GreetMe Dashboard Upgrade - Folder Setup Script
# Run this from your greetme-frontend root directory

Write-Host "Creating GreetMe Dashboard folder structure..." -ForegroundColor Green

# Create directories if they don't exist
$directories = @(
    "src/components",
    "src/pages",
    "src/services",
    "src/utils"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Cyan
    } else {
        Write-Host "Exists: $dir" -ForegroundColor Yellow
    }
}

Write-Host "`nFolder structure ready!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Extract the ZIP file contents to this directory" -ForegroundColor White
Write-Host "2. Run: npm install date-fns papaparse lucide-react" -ForegroundColor White
Write-Host "3. Test locally with: npm run dev" -ForegroundColor White
Write-Host "4. Deploy to production when ready" -ForegroundColor White
Write-Host "`nDone! See README.md for detailed instructions." -ForegroundColor Green
