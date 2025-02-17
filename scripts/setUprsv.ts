import { config } from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { poolsList } from "../src/mappings/poolsList";
import { Client } from 'pg';

// Cargar variables de entorno al inicio del script
config();

const execAsync = promisify(exec);

// Función de reintento con delay exponencial
async function retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 2000,
    backoff: number = 2
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        console.log(`⚠️ Reintentando en ${delay}ms... (${retries} intentos restantes)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * backoff, backoff);
    }
}

// Función para obtener las reservas usando el CLI de Soroban
async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
    try {
        const command = `docker-compose run --rm work-subql soroban contract invoke \
            --id "${contractId}" \
            --network mainnet \
            --source "${process.env.SECRET_KEY_HELPER}" \
            --rpc-url "${process.env.SOROBAN_ENDPOINT}" \
            -- get_reserves`;

        // Usar la función de reintento
        const { stdout } = await retry(() => execAsync(command));
        const jsonOutput = stdout.trim().split('\n').pop() || '[]';
        const [reserve0, reserve1] = JSON.parse(jsonOutput);
        
        return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error) {
        console.error(`❌ Error obteniendo reservas para ${contractId}:`, error);
        // Usar valores por defecto en caso de error
        console.warn(`⚠️ Usando valores por defecto para el pool ${contractId}`);
        return [BigInt(0), BigInt(0)];
    }
}
// principal function

async function setUpInitialPools(): Promise<void> {
    let client: Client | null = null;
    const failedPools: string[] = [];
    
    try {
        // Crear nuevo cliente
        client = new Client({
            host: 'localhost',
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: 'postgres',
            connectionTimeoutMillis: 5000
        });

        // Intentar conectar una sola vez con retry
        await retry(async () => {
            try {
                await client!.connect();
            } catch (error) {
                console.error("Error conectando a PostgreSQL:", error);
                throw error;
            }
        });

        console.log("🚀 Iniciando configuración de pools iniciales...");
        
        for (const [index, contract] of poolsList.entries()) {
            try {
                console.log(`📊 Procesando pool ${index + 1}/${poolsList.length}: ${contract}`);
                
                const [reserve0, reserve1] = await getPoolReserves(contract);
                
                if (reserve0 === BigInt(0) && reserve1 === BigInt(0)) {
                    failedPools.push(contract);
                }
                
                const query = `
                    INSERT INTO app.syncs 
                    (id, ledger, date, contract, new_reserve0, new_reserve1, _id, _block_range)
                    VALUES ($1, $2, $3, $4, $5, $6, gen_random_uuid(), int8range($7, NULL))
                `;
                
                const values = [
                    contract,
                    55735990 + index,
                    new Date(Date.now() - index * 60000),
                    contract,
                    reserve0.toString(),
                    reserve1.toString(),
                    55735990 + index
                ];

                await client.query(query, values);
                console.log(`✅ Pool guardado: ${contract}`);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error procesando pool ${contract}:`, error);
                failedPools.push(contract);
                continue;
            }
        }
    } catch (error) {
        console.error("❌ Error general:", error);
        throw error;
    } finally {
        if (client) {
            await client.end();
        }
        
        console.log("\n📊 Resumen de la ejecución:");
        console.log(`✅ Pools procesados exitosamente: ${poolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            console.log(`❌ Pools con errores (${failedPools.length}):`);
            failedPools.forEach(pool => console.log(`   - ${pool}`));
        }
    }
}

// Verificar variables de entorno
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER) {
    console.error("❌ Error: Variables de entorno SOROBAN_ENDPOINT y SECRET_KEY_HELPER son requeridas");
    process.exit(1);
}

// Primero instalar pg:
// yarn add pg @types/pg

setUpInitialPools()
    .then(() => {
        console.log("✨ Configuración de pools completada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error en la configuración de pools:", error);
        process.exit(1);
    });