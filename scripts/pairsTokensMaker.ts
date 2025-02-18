import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { poolsList } from "../src/mappings/poolsList";
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno al inicio del script
config();

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
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkitRsv = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkitRsv.getNetworkToolkit("mainnet"),
            contractId,
            'get_reserves',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        const [reserve0, reserve1] = scValToNative(result.result.retval);
        console.log("RESULT 🔴🟣🟢🔵")
        console.log(scValToNative(result.result.retval));
        return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error) {
        console.error(`❌ Error obteniendo reservas para ${contractId}:`, error);
        console.warn(`⚠️ Usando valores por defecto para el pool ${contractId}`);
        return [BigInt(0), BigInt(0)];
    }
}

async function generatePoolReservesList(): Promise<void> {
    const poolReserves: { contract: string; reserve0: string; reserve1: string; }[] = [];
    const failedPools: string[] = [];
    
    try {
        console.log("🚀 Obteniendo reservas de pools...");
        
        for (const [index, contract] of poolsList.entries()) {
            try {
                console.log(`📊 Procesando pool ${index + 1}/${poolsList.length}: ${contract}`);
                
                const [reserve0, reserve1] = await retry(() => getPoolReserves(contract));
                
                poolReserves.push({
                    contract,
                    reserve0: reserve0.toString(),
                    reserve1: reserve1.toString()
                });
                
                console.log(`✅ Reservas obtenidas para: ${contract}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error procesando pool ${contract}:`, error);
                failedPools.push(contract);
                continue;
            }
        }

        // Generar el contenido del archivo
        const fileContent = `
// Este archivo es generado automáticamente por poolRsvMaker.ts
// No modificar manualmente

export interface PoolReserves {
    contract: string;
    reserve0: string;
    reserve1: string;
}

export const poolReservesList: PoolReserves[] = ${JSON.stringify(poolReserves, null, 2)};
`;

        // Escribir el archivo
        const filePath = path.join(__dirname, '../src/mappings/poolRsvList.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ Archivo poolRsvList.ts generado exitosamente`);

    } catch (error) {
        console.error("❌ Error general:", error);
        throw error;
    } finally {
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

generatePoolReservesList()
    .then(() => {
        console.log("✨ Lista de reservas de pools generada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error generando lista de reservas:", error);
        process.exit(1);
    });