#!/bin/sh
set -e

echo "[RailSetu Backend] Starting container initialization..."

# Generate Prisma Client
echo "[RailSetu Backend] Generating Prisma client..."
npx prisma generate

# Apply migrations
echo "[RailSetu Backend] Applying database migrations..."
npx prisma migrate deploy

# Run seeds if AUTO_SEED is set to true (default true on first deploy)
if [ "$AUTO_SEED" = "true" ]; then
  echo "[RailSetu Backend] Seeding database with initial railway demonstration datasets..."
  npm run db:seed || echo "[RailSetu Backend] Seed completed or already seeded."
fi

echo "[RailSetu Backend] Starting Express API server..."
exec npm start
