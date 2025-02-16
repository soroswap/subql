#!/bin/bash
set -e

# Cargar variables de entorno
source .env

echo "🔄 Deteniendo servicios previos..."
docker-compose down -v && sudo rm -rf .data && sudo rm -rf dist

echo "🛠 Generando y construyendo el proyecto..."
subql codegen && subql build

echo "🚀 Iniciando todos los servicios..."
docker-compose up -d

echo "⏳ Esperando a que los servicios estén disponibles..."
until docker exec -i postgres psql -U postgres -c '\l'; do
    echo "PostgreSQL no está listo aún... esperando 5 segundos"
    sleep 5
done

# Esperar a que subquery-node cree las tablas
echo "⏳ Esperando a que subquery-node inicialice el esquema..."
sleep 30  # Dar tiempo para que subquery-node cree las tablas

echo "🌱 Ejecutando script de inicialización de pools..."
yarn setup-pools

if [ $? -eq 0 ]; then
    echo "✅ Inicialización de pools completada exitosamente"
    echo "📊 Puedes acceder al playground GraphQL en http://localhost:3000"
    
    echo "📝 Mostrando logs de los contenedores..."
    docker-compose logs -f
else
    echo "❌ Error durante la inicialización de pools"
    docker-compose down
    exit 1
fi