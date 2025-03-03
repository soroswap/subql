import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const FACTORY_CONTRACT_AQUA = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK";
const BATCH_SIZE = 10; // Número de conjuntos de tokens a procesar por lote

// Retry function con retraso exponencial
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

const networkToolkit = sorobanToolkit.getNetworkToolkit("mainnet");

async function getPlaneAddress(): Promise<string> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_plane',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval);
    } catch (error) {
        console.error('❌ Error obteniendo la dirección del plane:', error);
        throw error;
    }
}

async function getTokenSetsCount(): Promise<number> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_tokens_sets_count',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return Number(scValToNative(result.result.retval));
    } catch (error) {
        console.error('❌ Error obteniendo el número total de token sets:', error);
        throw error;
    }
}

async function getTokens(index: number): Promise<string[]> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_tokens',
            [xdr.ScVal.scvU128(BigInt(index))],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval);
    } catch (error) {
        console.error(`❌ Error obteniendo tokens para índice ${index}:`, error);
        throw error;
    }
}

async function getPools(tokens: string[]): Promise<{[key: string]: string}> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_pools',
            [xdr.ScVal.scvVec(tokens.map(token => xdr.ScVal.scvAddress(new Address(token))))],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval);
    } catch (error) {
        console.error('❌ Error obteniendo pools para tokens:', tokens, error);
        throw error;
    }
}

async function generateAquaPoolsList(): Promise<void> {
    const aquaPools: {
        tokens: string[];
        pools: {[key: string]: string};
    }[] = [];
    const failedSets: number[] = [];

    try {
        console.log("🚀 Obteniendo información de pools de Aqua...");
        
        const totalSets = await retry(() => getTokenSetsCount());
        console.log(`📊 Total de conjuntos de tokens encontrados: ${totalSets}`);

        for (let i = 0; i < totalSets; i++) {
            try {
                console.log(`📊 Procesando conjunto de tokens ${i + 1}/${totalSets}`);
                
                const tokens = await retry(() => getTokens(i));
                console.log(`✅ Tokens obtenidos: ${tokens.length}`);
                
                const pools = await retry(() => getPools(tokens));
                console.log(`✅ Pools obtenidos para el conjunto ${i + 1}`);
                
                aquaPools.push({
                    tokens,
                    pools
                });
                
                // Pequeña pausa entre llamadas
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error procesando conjunto ${i}:`, error);
                failedSets.push(i);
                continue;
            }
        }

        // Generar contenido del archivo
        const fileContent = `
// Este archivo fue generado automáticamente por AquapoolsTokensMaker.ts
// No modificar manualmente

export interface AquaPoolSet {
    tokens: string[];
    pools: {[key: string]: string};  // pool_id -> address
}

export const aquaPoolsList: AquaPoolSet[] = ${JSON.stringify(aquaPools, null, 2)};
`;

        // Escribir archivo
        const filePath = path.join(__dirname, '../src/mappings/aquaPools.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ aquaPools.ts generado exitosamente`);

    } catch (error) {
        console.error("❌ Error general:", error);
        throw error;
    } finally {
        console.log("\n📊 Resumen de ejecución:");
        console.log(`✅ Conjuntos de pools procesados exitosamente: ${aquaPools.length}`);
        if (failedSets.length > 0) {
            console.log(`❌ Conjuntos con errores (${failedSets.length}):`);
            failedSets.forEach(set => console.log(`   - ${set}`));
        }
    }
}

// Verificar variables de entorno
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER) {
    console.error("❌ Error: SOROBAN_ENDPOINT y SECRET_KEY_HELPER son requeridas");
    process.exit(1);
}

generateAquaPoolsList()
    .then(() => {
        console.log("✨ Dirección del plane de Aqua obtenida exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error obteniendo la dirección del plane:", error);
        process.exit(1);
    });
