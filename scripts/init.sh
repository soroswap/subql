#!/bin/bash
set -e

# Cargar variables de entorno
source .env

echo "🔄 Deteniendo servicios previos..."
docker-compose down -v && sudo rm -rf .data && sudo rm -rf dist

echo "Inicializando datos"
yarn pool-rsv
yarn pairs-rsv

echo "INICIANDO SOROSWAP SUBQUERY"
yarn dev
