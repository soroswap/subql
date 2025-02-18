#!/bin/bash
set -e

# Cargar variables de entorno
source .env

echo "🔄 Deteniendo servicios previos..."
docker-compose down -v && sudo rm -rf .data && sudo rm -rf dist

echo "Consultando las reservas para la inicialización de los pools..."
yarn pool-rsv

echo "INICIANDO SOROSWAP SUBQUERY"
yarn dev
