import { config } from 'dotenv';
import { Sync } from '../src/types';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { poolsList } from "../src/mappings/poolsList";

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

// Función principal
async function setUpInitialPools(): Promise<void> {
    const failedPools: string[] = [];
    
    try {
        console.log("🚀 Iniciando configuración de pools iniciales...");
        
        for (const [index, contract] of poolsList.entries()) {
            try {
                console.log(`📊 Procesando pool ${index + 1}/${poolsList.length}: ${contract}`);
                
                const [reserve0, reserve1] = await getPoolReserves(contract);
                
                if (reserve0 === BigInt(0) && reserve1 === BigInt(0)) {
                    failedPools.push(contract);
                }
                
                // Crear nuevo Sync usando SubQuery
                const newSync = Sync.create({
                    id: contract,
                    ledger: 55735990 + index,
                    date: new Date(Date.now() - index * 60000),
                    contract: contract,
                    newReserve0: reserve0,
                    newReserve1: reserve1
                });

                await newSync.save();
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

setUpInitialPools()
    .then(() => {
        console.log("✨ Configuración de pools completada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error en la configuración de pools:", error);
        process.exit(1);
    });