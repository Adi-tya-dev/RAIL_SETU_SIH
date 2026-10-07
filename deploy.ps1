Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    RailSetu - Complete Docker Deployment" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please start Docker Desktop or install it from https://docs.docker.com/desktop/"
    exit 1
}

Write-Host "🚀 Building and starting RailSetu containers..." -ForegroundColor Yellow
docker compose down
docker compose up -d --build

Write-Host ""
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "✅ RailSetu is successfully deployed and running!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "🌐 Frontend Dashboard: http://localhost" -ForegroundColor White
Write-Host "🔌 Backend API:        http://localhost:5000/api" -ForegroundColor White
Write-Host "🗄️ Database:           localhost:5432 (railway_block_planning)" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To view live logs: docker compose logs -f" -ForegroundColor Cyan
Write-Host "To stop:           docker compose down" -ForegroundColor Cyan
