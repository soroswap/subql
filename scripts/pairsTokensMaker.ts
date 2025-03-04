import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Load environment variables at the beginning of the script
config();

// Configuración
const CONFIG = {
    chunkSize: 5,           // Número de pares a procesar en paralelo
    retryAttempts: 3,        // Intentos de reintento para operaciones fallidas
    retryDelay: 2000,        // Retraso inicial entre reintentos (ms)
    retryBackoff: 2,         // Factor de backoff para reintentos
    pauseBetweenChunks: 500, // Pausa entre chunks (ms)
    checkpointInterval: 10,  // Guardar checkpoint cada N chunks
};

// Interfaces
interface PairTokenReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
}

interface Checkpoint {
    lastProcessedIndex: number;
    timestamp: Date;
    pairsCount: number;
}

interface ProcessingStats {
    startTime: number;
    endTime?: number;
    totalPairs: number;
    processedPairs: number;
    successfulPairs: number;
    failedPairs: number[];
}

// Estadísticas
const stats: ProcessingStats = {
    startTime: performance.now(),
    totalPairs: 0,
    processedPairs: 0,
    successfulPairs: 0,
    failedPairs: []
};

// Retry function with exponential delay
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

const FACTORY_CONTRACT = process.env.FACTORY_CONTRACT_SOROSWAP as string;

// Add this at the top level of the file
const mainnet = {
    network: process.env.NETWORK as string,
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

// Create a single instance of networkToolkit
const networkToolkit = sorobanToolkit.getNetworkToolkit(process.env.NETWORK as string);

async function getAllPairsLength(): Promise<number> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT,
            'all_pairs_length',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return Number(scValToNative(result.result.retval));
    } catch (error) {
        console.error('❌ Error getting total number of pairs:', error);
        throw error;
    }
}

async function getPairAddress(index: number): Promise<string> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            FACTORY_CONTRACT,
            'all_pairs',
            [xdr.ScVal.scvU32(index)],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval);
    } catch (error) {
        console.error(`❌ Error getting pair address ${index}:`, error);
        throw error;
    }
}

async function getToken(pairAddress: string, method: 'token_0' | 'token_1'): Promise<string> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            pairAddress,
            method,
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        return scValToNative(result.result.retval);
    } catch (error) {
        console.error(`❌ Error getting token (${method}) for pair ${pairAddress}:`, error);
        throw error;
    }
}

async function getPairReserves(pairAddress: string): Promise<[bigint, bigint]> {
    try {
        const result = await invokeCustomContract(
            networkToolkit,
            pairAddress,
            'get_reserves',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );
        const [reserve0, reserve1] = scValToNative(result.result.retval);
        return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error) {
        console.error(`❌ Error getting reserves for ${pairAddress}:`, error);
        return [BigInt(0), BigInt(0)];
    }
}

// Funciones de utilidad
async function saveCheckpoint(index: number, pairsCount: number): Promise<void> {
    const checkpoint: Checkpoint = {
        lastProcessedIndex: index,
        timestamp: new Date(),
        pairsCount
    };
    
    const checkpointPath = path.join(__dirname, '../.pairs-checkpoint.json');
    await fs.promises.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
    console.log(`📝 Checkpoint guardado en índice ${index}`);
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
    const checkpointPath = path.join(__dirname, '../.pairs-checkpoint.json');
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

function estimateTimeRemaining(processedPairs: number, totalPairs: number, elapsedMs: number): string {
    if (processedPairs === 0) return "Calculando...";
    
    const msPerPair = elapsedMs / processedPairs;
    const remainingPairs = totalPairs - processedPairs;
    const remainingMs = msPerPair * remainingPairs;
    
    return formatElapsedTime(remainingMs);
}

function isValidPairData(pair: any): boolean {
    return (
        typeof pair === 'object' &&
        typeof pair.address === 'string' &&
        typeof pair.token_a === 'string' &&
        typeof pair.token_b === 'string' &&
        typeof pair.reserve_a === 'string' &&
        typeof pair.reserve_b === 'string' &&
        pair.address.length > 0 &&
        pair.token_a.length > 0 &&
        pair.token_b.length > 0
    );
}

// Función principal
async function generatePairTokenReservesList(): Promise<void> {
    const pairTokenReserves: PairTokenReserves[] = [];
    let startIndex = 0;
    
    try {
        console.log("🚀 Iniciando generación de lista de pares...");
        
        // Intentar cargar checkpoint
        const checkpoint = await loadCheckpoint();
        if (checkpoint) {
            console.log(`📝 Checkpoint encontrado: índice ${checkpoint.lastProcessedIndex}, ${checkpoint.pairsCount} pares`);
            startIndex = checkpoint.lastProcessedIndex + 1;
            console.log(`🔄 Continuando desde el índice ${startIndex}`);
        }
        
        // Obtener total de pares
        const totalPairs = await retry(() => getAllPairsLength());
        stats.totalPairs = totalPairs;
        console.log(`📊 Total de pares encontrados: ${totalPairs}`);
        
        // Procesar en chunks
        for (let i = startIndex; i < totalPairs; i += CONFIG.chunkSize) {
            const chunkStart = performance.now();
            const chunk = Array.from(
                {length: Math.min(CONFIG.chunkSize, totalPairs - i)}, 
                (_, index) => i + index
            );
            
            console.log(`\n📦 Procesando chunk ${Math.floor(i/CONFIG.chunkSize) + 1}/${Math.ceil(totalPairs/CONFIG.chunkSize)} (índices ${i}-${i + chunk.length - 1})`);
            
            // Procesar chunk en paralelo
            const promises = chunk.map(async (index) => {
                try {
                    console.log(`🔍 Procesando par ${index}/${totalPairs-1} (${((index+1)/totalPairs*100).toFixed(1)}%)`);
                    
                    // Obtener dirección del par
                    const pairAddress = await retry(() => getPairAddress(index));
                    
                    // Obtener tokens
                    const token_a = await retry(() => getToken(pairAddress, 'token_0'));
                    const token_b = await retry(() => getToken(pairAddress, 'token_1'));
                    
                    // Obtener reservas
                    const [reserve_a, reserve_b] = await retry(() => getPairReserves(pairAddress));
                    
                    // Crear objeto de par
                    const pairData: PairTokenReserves = {
                        address: pairAddress,
                        token_a,
                        token_b,
                        reserve_a: reserve_a.toString(),
                        reserve_b: reserve_b.toString()
                    };
                    
                    // Validar datos
                    if (!isValidPairData(pairData)) {
                        throw new Error(`Datos de par inválidos para índice ${index}`);
                    }
                    
                    stats.successfulPairs++;
                    return pairData;
                } catch (error) {
                    console.error(`❌ Error en índice ${index}:`, error);
                    stats.failedPairs.push(index);
                    return null;
                } finally {
                    stats.processedPairs++;
                }
            });
            
            // Esperar resultados
            const results = await Promise.all(promises);
            const validResults = results.filter(Boolean) as PairTokenReserves[];
            
            // Añadir todos los resultados válidos a la lista final
            pairTokenReserves.push(...validResults);
            
            // Guardar checkpoint periódicamente
            if (i % (CONFIG.chunkSize * CONFIG.checkpointInterval) === 0 && i > 0) {
                await saveCheckpoint(i, pairTokenReserves.length);
            }
            
            // Calcular estadísticas
            const chunkTime = performance.now() - chunkStart;
            const elapsedTotal = performance.now() - stats.startTime;
            const progress = Math.min(((i + chunk.length) * 100) / totalPairs, 100).toFixed(2);
            const timeRemaining = estimateTimeRemaining(stats.processedPairs, totalPairs, elapsedTotal);
            
            // Mostrar progreso
            console.log(`⏱️ Tiempo chunk: ${(chunkTime/1000).toFixed(2)}s | Total: ${formatElapsedTime(elapsedTotal)}`);
            console.log(`📈 Progreso: ${progress}% | Restante: ${timeRemaining}`);
            console.log(`📊 Pares: ${pairTokenReserves.length} | Éxitos: ${stats.successfulPairs}/${stats.processedPairs}`);
            
            // Pausa entre chunks
            await new Promise(resolve => setTimeout(resolve, CONFIG.pauseBetweenChunks));
        }
        
        // Finalizar estadísticas
        stats.endTime = performance.now();
        
        // Generar contenido del archivo
        const fileContent = `
// Este archivo fue generado automáticamente por pairsTokensMaker.ts
// No modificar manualmente
// Generado: ${new Date().toISOString()}
// Total de pares: ${pairTokenReserves.length}

export interface PairTokenReserves {
    address: string;
    token_a: string;
    token_b: string;
    reserve_a: string;
    reserve_b: string;
}

export const pairTokenReservesList: PairTokenReserves[] = ${JSON.stringify(pairTokenReserves, null, 2)};
`;

        // Escribir archivo
        const filePath = path.join(__dirname, '../src/mappings/pairTokenRsv.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`\n✅ pairTokenRsv.ts generado exitosamente en ${filePath}`);
        
        // Generar reporte
        const totalTime = stats.endTime! - stats.startTime;
        console.log("\n📊 Resumen de ejecución:");
        console.log(`⏱️ Tiempo total: ${formatElapsedTime(totalTime)}`);
        console.log(`✅ Pares procesados: ${stats.processedPairs}/${stats.totalPairs} (${((stats.processedPairs/stats.totalPairs)*100).toFixed(2)}%)`);
        console.log(`✅ Pares exitosos: ${stats.successfulPairs} (${((stats.successfulPairs/stats.processedPairs)*100).toFixed(2)}%)`);
        console.log(`✅ Total pares guardados: ${pairTokenReserves.length}`);
        
        if (stats.failedPairs.length > 0) {
            console.log(`❌ Pares con errores: ${stats.failedPairs.length}`);
            // Guardar errores en archivo
            const errorPath = path.join(__dirname, '../pairs-errors.json');
            fs.writeFileSync(errorPath, JSON.stringify(stats.failedPairs, null, 2));
            console.log(`📝 Lista de errores guardada en ${errorPath}`);
        }
        
        // Eliminar checkpoint si se completó
        const checkpointPath = path.join(__dirname, '../.pairs-checkpoint.json');
        if (fs.existsSync(checkpointPath)) {
            fs.unlinkSync(checkpointPath);
            console.log(`🧹 Checkpoint eliminado`);
        }

    } catch (error) {
        console.error("❌ Error general:", error);
        
        // Guardar checkpoint de emergencia
        if (pairTokenReserves.length > 0) {
            const emergencyPath = path.join(__dirname, '../pairs-emergency.json');
            fs.writeFileSync(emergencyPath, JSON.stringify(pairTokenReserves, null, 2));
            console.log(`🆘 Datos guardados en ${emergencyPath}`);
        }
        
        throw error;
    }
}

// Check environment variables
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER || !process.env.FACTORY_CONTRACT_SOROSWAP) {
    console.error("❌ Error: SOROBAN_ENDPOINT, SECRET_KEY_HELPER y FACTORY_CONTRACT_SOROSWAP son requeridas");
    process.exit(1);
}

generatePairTokenReservesList()
    .then(() => {
        console.log("✨ Lista de pares, tokens y reservas generada exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error generando la lista:", error);
        process.exit(1);
    });