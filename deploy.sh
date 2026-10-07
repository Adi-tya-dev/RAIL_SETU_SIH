#!/bin/bash
set -e

echo "=================================================="
echo "    RailSetu - Complete Docker Deployment"
echo "=================================================="

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH."
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

echo "🚀 Building and starting RailSetu containers..."
docker compose down || true
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 5

echo ""
echo "=================================================="
echo "✅ RailSetu is successfully deployed and running!"
echo "=================================================="
echo "🌐 Frontend Dashboard: http://localhost"
echo "🔌 Backend API:        http://localhost:5000/api"
echo "🗄️ Database:           localhost:5432 (railway_block_planning)"
echo "=================================================="
echo ""
echo "To view live logs: docker compose logs -f"
echo "To stop:           docker compose down"
