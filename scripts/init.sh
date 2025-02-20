#!/bin/bash
set -e

# Load environment variables
source .env

echo "🔄 Stopping previous services..."
docker-compose down -v && sudo rm -rf .data && sudo rm -rf dist

echo "Initializing data"
yarn pool-rsv
yarn pairs-rsv

echo "STARTING SOROSWAP SUBQUERY"
yarn dev
