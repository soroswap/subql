import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Address, Keypair, scValToNative, xdr, nativeToScVal, ScInt } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Load environment variables
config();

const FACTORY_CONTRACT_AQUA = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK";

// Configuración
const CONFIG = {
    chunkSize: 10,           // Número de pools a procesar en paralelo
    retryAttempts: 3,        // Intentos de reintento para operaciones fallidas
    retryDelay: 2000,        // Retraso inicial entre reintentos (ms)
    retryBackoff: 1.5,       // Factor de backoff para reintentos
    pauseBetweenChunks: 500, // Pausa entre chunks (ms)
    checkpointInterval: 20,  // Guardar checkpoint cada N chunks
    cacheResults: true       // Usar caché para evitar duplicados
};

// Interfaces
interface AquaPool {
    tokenA: string;
    tokenB: string;
    address: string;
}

interface Checkpoint {
    lastProcessedIndex: number;
    timestamp: Date;
    poolsCount: number;
}

interface DuplicatePool {
    key: string;
    tokenA: string;
    tokenB: string;
    addresses: string[];
}

interface ProcessingStats {
    startTime: number;
    endTime?: number;
    totalSets: number;
    processedSets: number;
    successfulSets: number;
    failedSets: number[];
    uniquePools: number;
    duplicatePools: number;
}

// Caché para evitar duplicados
const processedPools = new Map<string, AquaPool>();
const duplicatePools = new Map<string, DuplicatePool>();
const stats: ProcessingStats = {
    startTime: performance.now(),
    totalSets: 0,
    processedSets: 0,
    successfulSets: 0,
    failedSets: [],
    uniquePools: 0,
    duplicatePools: 0
};

// Retry function con retraso exponencial
async function retry<T>(
    fn: () => Promise<T>,
    retries: number = CONFIG.retryAttempts,
    delay: number = CONFIG.retryDelay,
    backoff: number = CONFIG.retryBackoff
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

// Configuración de Soroban
const mainnet = {
    network: "mainnet",
    friendbotUrl: "",
    horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
    sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
    networkPassphrase: process.env.CHAIN_ID as string
};

const sorobanToolkit = createToolkit({
    adminSecret: process.env.SECRET_KEY_HELPER as string,
    contractPaths: {},
    addressBookPath: "",
    customNetworks: [mainnet],
    verbose: "full"
});

const networkToolkit = sorobanToolkit.getNetworkToolkit("mainnet");

// Funciones para interactuar con el contrato
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
        const indexScVal = new ScInt(BigInt(index)).toU128();
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_tokens',
            [indexScVal],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval) as string[];
    } catch (error) {
        console.error(`❌ Error obteniendo tokens para índice ${index}:`, error);
        throw error;
    }
}

async function getPools(tokens: string[]): Promise<{ [key: string]: string }> {
    try {
        const tokenScVals = tokens.map(token => 
            nativeToScVal(token, { type: 'address' })
        );
        
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT_AQUA,
            'get_pools',
            [xdr.ScVal.scvVec(tokenScVals)],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval) as { [key: string]: string };
    } catch (error) {
        console.error('❌ Error obteniendo pools para tokens:', tokens, error);
        throw error;
    }
}

// Funciones de utilidad
function createPoolKey(tokenA: string, tokenB: string): string {
    return [tokenA, tokenB].sort().join('-');
}

function isValidPoolData(pool: any): boolean {
    return (
        typeof pool === 'object' &&
        typeof pool.tokenA === 'string' &&
        typeof pool.tokenB === 'string' &&
        typeof pool.address === 'string' &&
        pool.tokenA.length > 0 &&
        pool.tokenB.length > 0 &&
        pool.address.length > 0
    );
}

async function saveCheckpoint(index: number, poolsCount: number): Promise<void> {
    const checkpoint: Checkpoint = {
        lastProcessedIndex: index,
        timestamp: new Date(),
        poolsCount
    };
    
    const checkpointPath = path.join(__dirname, '../.aquapools-checkpoint.json');
    await fs.promises.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
    console.log(`📝 Checkpoint guardado en índice ${index}`);
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
    const checkpointPath = path.join(__dirname, '../.aquapools-checkpoint.json');
    try {
        const data = await fs.promises.readFile(checkpointPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

function formatElapsedTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

function estimateTimeRemaining(processedSets: number, totalSets: number, elapsedMs: number): string {
    if (processedSets === 0) return "Calculando...";
    
    const msPerSet = elapsedMs / processedSets;
    const remainingSets = totalSets - processedSets;
    const remainingMs = msPerSet * remainingSets;
    
    return formatElapsedTime(remainingMs);
}

// Función principal
async function generateAquaPoolsList(): Promise<void> {
    const aquaPools: AquaPool[] = [];
    let startIndex = 0;
    
    try {
        console.log("🚀 Iniciando generación de lista de pools de Aqua...");
        
        // Intentar cargar checkpoint
        const checkpoint = await loadCheckpoint();
        if (checkpoint) {
            console.log(`📝 Checkpoint encontrado: índice ${checkpoint.lastProcessedIndex}, ${checkpoint.poolsCount} pools`);
            startIndex = checkpoint.lastProcessedIndex + 1;
            console.log(`🔄 Continuando desde el índice ${startIndex}`);
        }
        
        // Obtener total de sets
        const totalSets = await retry(() => getTokenSetsCount());
        stats.totalSets = totalSets;
        console.log(`📊 Total de conjuntos de tokens: ${totalSets}`);
        
        // Procesar en chunks
        for (let i = startIndex; i < totalSets; i += CONFIG.chunkSize) {
            const chunkStart = performance.now();
            const chunk = Array.from(
                {length: Math.min(CONFIG.chunkSize, totalSets - i)}, 
                (_, index) => i + index
            );
            
            console.log(`\n📦 Procesando chunk ${Math.floor(i/CONFIG.chunkSize) + 1}/${Math.ceil(totalSets/CONFIG.chunkSize)} (índices ${i}-${i + chunk.length - 1})`);
            
            // Procesar chunk en paralelo
            const promises = chunk.map(async (index) => {
                try {
                    console.log(`🔍 Procesando índice ${index}/${totalSets-1} (${((index+1)/totalSets*100).toFixed(1)}%)`);
                    
                    // Obtener tokens
                    const tokens = await retry(() => getTokens(index));
                    if (!tokens || tokens.length < 2) {
                        throw new Error(`Tokens inválidos para índice ${index}`);
                    }
                    
                    // Obtener pools
                    const pools = await retry(() => getPools(tokens));
                    if (!pools || Object.keys(pools).length === 0) {
                        throw new Error(`No se encontraron pools para índice ${index}`);
                    }
                    
                    const poolAddress = Object.values(pools)[0];
                    if (!poolAddress) {
                        throw new Error(`Dirección de pool inválida para índice ${index}`);
                    }
                    
                    // Crear objeto de pool
                    const poolData: AquaPool = {
                        tokenA: tokens[0],
                        tokenB: tokens[1],
                        address: poolAddress
                    };
                    
                    // Validar datos
                    if (!isValidPoolData(poolData)) {
                        throw new Error(`Datos de pool inválidos para índice ${index}`);
                    }
                    
                    stats.successfulSets++;
                    return poolData;
                } catch (error) {
                    console.error(`❌ Error en índice ${index}:`, error);
                    stats.failedSets.push(index);
                    return null;
                } finally {
                    stats.processedSets++;
                }
            });
            
            // Esperar resultados
            const results = await Promise.all(promises);
            const validResults = results.filter(Boolean) as AquaPool[];
            
            // Añadir todos los resultados válidos a la lista final
            aquaPools.push(...validResults);
            
            // Guardar checkpoint periódicamente
            if (i % (CONFIG.chunkSize * CONFIG.checkpointInterval) === 0 && i > 0) {
                await saveCheckpoint(i, aquaPools.length);
            }
            
            // Calcular estadísticas
            const chunkTime = performance.now() - chunkStart;
            const elapsedTotal = performance.now() - stats.startTime;
            const progress = Math.min(((i + chunk.length) * 100) / totalSets, 100).toFixed(2);
            const timeRemaining = estimateTimeRemaining(stats.processedSets, totalSets, elapsedTotal);
            
            // Mostrar progreso
            console.log(`⏱️ Tiempo chunk: ${(chunkTime/1000).toFixed(2)}s | Total: ${formatElapsedTime(elapsedTotal)}`);
            console.log(`📈 Progreso: ${progress}% | Restante: ${timeRemaining}`);
            console.log(`📊 Pools: ${aquaPools.length} | Éxitos: ${stats.successfulSets}/${stats.processedSets}`);
            
            // Pausa entre chunks
            await new Promise(resolve => setTimeout(resolve, CONFIG.pauseBetweenChunks));
        }
        
        // Finalizar estadísticas
        stats.endTime = performance.now();
        
        // Generar contenido del archivo
        const fileContent = `
// Este archivo fue generado automáticamente por AquapoolsTokensMaker.ts
// No modificar manualmente
// Generado: ${new Date().toISOString()}
// Total de pools: ${aquaPools.length}

export interface AquaPool {
    tokenA: string;
    tokenB: string;
    address: string;
}

export const aquaPoolsList: AquaPool[] = ${JSON.stringify(aquaPools, null, 2)};
`;

        // Escribir archivo
        const filePath = path.join(__dirname, '../src/mappings/aquaPools.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`\n✅ aquaPools.ts generado exitosamente en ${filePath}`);
        
        // Generar reporte
        const totalTime = stats.endTime! - stats.startTime;
        console.log("\n📊 Resumen de ejecución:");
        console.log(`⏱️ Tiempo total: ${formatElapsedTime(totalTime)}`);
        console.log(`✅ Sets procesados: ${stats.processedSets}/${stats.totalSets} (${((stats.processedSets/stats.totalSets)*100).toFixed(2)}%)`);
        console.log(`✅ Sets exitosos: ${stats.successfulSets} (${((stats.successfulSets/stats.processedSets)*100).toFixed(2)}%)`);
        console.log(`✅ Total pools guardados: ${aquaPools.length}`);
        
        if (stats.failedSets.length > 0) {
            console.log(`❌ Sets con errores: ${stats.failedSets.length}`);
            // Guardar errores en archivo
            const errorPath = path.join(__dirname, '../aquapools-errors.json');
            fs.writeFileSync(errorPath, JSON.stringify(stats.failedSets, null, 2));
            console.log(`📝 Lista de errores guardada en ${errorPath}`);
        }
        
        // Eliminar checkpoint si se completó
        const checkpointPath = path.join(__dirname, '../.aquapools-checkpoint.json');
        if (fs.existsSync(checkpointPath)) {
            fs.unlinkSync(checkpointPath);
            console.log(`🧹 Checkpoint eliminado`);
        }

    } catch (error) {
        console.error("❌ Error general:", error);
        
        // Guardar checkpoint de emergencia
        if (aquaPools.length > 0) {
            const emergencyPath = path.join(__dirname, '../aquapools-emergency.json');
            fs.writeFileSync(emergencyPath, JSON.stringify(aquaPools, null, 2));
            console.log(`🆘 Datos guardados en ${emergencyPath}`);
        }
        
        throw error;
    }
}

// Verificar variables de entorno
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER) {
    console.error("❌ Error: SOROBAN_ENDPOINT y SECRET_KEY_HELPER son requeridas");
    process.exit(1);
}

// Ejecutar la función principal
generateAquaPoolsList()
    .then(() => {
        console.log("✨ Lista de pools de Aqua generada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error generando la lista de pools:", error);
        process.exit(1);
    });