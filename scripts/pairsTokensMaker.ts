import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
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

const FACTORY_CONTRACT = 'CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2';

async function getAllPairsLength(): Promise<number> {
    try {
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkit = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkit.getNetworkToolkit("mainnet"),
            FACTORY_CONTRACT,
            'all_pairs_length',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        return Number(scValToNative(result.result.retval));
    } catch (error) {
        console.error('❌ Error obteniendo el número total de pairs:', error);
        throw error;
    }
}

async function getPairAddress(index: number): Promise<string> {
    try {
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkit = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkit.getNetworkToolkit("mainnet"),
            FACTORY_CONTRACT,
            'all_pairs',
            [xdr.ScVal.scvU32(index)],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        return scValToNative(result.result.retval);
    } catch (error) {
        console.error(`❌ Error obteniendo la dirección del pair ${index}:`, error);
        throw error;
    }
}

async function getToken(pairAddress: string, method: 'token_0' | 'token_1'): Promise<string> {
    try {
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkit = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkit.getNetworkToolkit("mainnet"),
            pairAddress,
            method,
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        return scValToNative(result.result.retval);
    } catch (error) {
        console.error(`❌ Error obteniendo el token (${method}) para el pair ${pairAddress}:`, error);
        throw error;
    }
}

async function getPairReserves(pairAddress: string): Promise<[bigint, bigint]> {
    try {
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkit = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkit.getNetworkToolkit("mainnet"),
            pairAddress,
            'get_reserves',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        const [reserve0, reserve1] = scValToNative(result.result.retval);
        return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error) {
        console.error(`❌ Error obteniendo reservas para ${pairAddress}:`, error);
        return [BigInt(0), BigInt(0)];
    }
}

async function generatePairTokenReservesList(): Promise<void> {
    const pairTokenReserves: {
        address: string;
        token_a: string;
        token_b: string;
        reserve_a: string;
        reserve_b: string;
    }[] = [];
    const failedPairs: string[] = [];
    const totalPairs = await getAllPairsLength();
        console.log(`📊 Total de pairs encontrados: ${totalPairs}`);
    try {
        console.log("🚀 Obteniendo información de pairs...");
        
        
        
        for (let i = 0; i < totalPairs; i++) {
            try {
                console.log(`📊 Procesando pair ${i + 1}/${totalPairs}`);
                
                const pairAddress = await retry(() => getPairAddress(i));
                const token_a = await retry(() => getToken(pairAddress, 'token_0'));
                const token_b = await retry(() => getToken(pairAddress, 'token_1'));
                const [reserve_a, reserve_b] = await retry(() => getPairReserves(pairAddress));
                
                pairTokenReserves.push({
                    address: pairAddress,
                    token_a,
                    token_b,
                    reserve_a: reserve_a.toString(),
                    reserve_b: reserve_b.toString()
                });
                
                console.log(`✅ Información obtenida para pair: ${pairAddress}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error procesando pair ${i}:`, error);
                failedPairs.push(`Pair índice ${i}`);
                continue;
            }
        }

        // Generar el contenido del archivo
        const fileContent = `
// Este archivo es generado automáticamente por pairsTokensMaker.ts
// No modificar manualmente

export interface PairTokenReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
}

export const pairTokenReservesList: PairTokenReserves[] = ${JSON.stringify(pairTokenReserves, null, 2)};
`;

        // Escribir el archivo
        const filePath = path.join(__dirname, '../src/mappings/pairTokenRsv.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ Archivo pairTokenRsv.ts generado exitosamente`);

    } catch (error) {
        console.error("❌ Error general:", error);
        throw error;
    } finally {
        console.log("\n📊 Resumen de la ejecución:");
        console.log(`✅ Pairs procesados exitosamente: ${pairTokenReserves.length}`);
        if (failedPairs.length > 0) {
            console.log(`❌ Pairs con errores (${failedPairs.length}):`);
            failedPairs.forEach(pair => console.log(`   - ${pair}`));
        }
    }
}

// Verificar variables de entorno
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER) {
    console.error("❌ Error: Variables de entorno SOROBAN_ENDPOINT y SECRET_KEY_HELPER son requeridas");
    process.exit(1);
}

generatePairTokenReservesList()
    .then(() => {
        console.log("✨ Lista de pairs, tokens y reservas generada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error generando lista:", error);
        process.exit(1);
    });