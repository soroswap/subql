import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Address, Keypair, scValToNative, xdr, nativeToScVal, ScInt, rpc } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { retry, toolkit } from "../toolkit";
import { NETWORK } from '../../src/constants';
import { getAquaFactory } from '../../src/constants/AquaContracts';

// "npm run aqua-pools": "ts-node -r dotenv/config scripts/aqua/AquapoolsTokensMaker.ts",
// Load environment variables
config();

//const FACTORY_CONTRACT_AQUA = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK";
const FACTORY_CONTRACT_AQUA = getAquaFactory(
    process.env.NETWORK as NETWORK
  ).address;
console.log("FACTORY_CONTRACT_AQUA", FACTORY_CONTRACT_AQUA);
 
// Configuración
const CONFIG = {
    chunkSize: 5,            // Reducido para evitar rate limiting
    retryAttempts: 3,        // Intentos de reintento para operaciones fallidas
    retryDelay: 2000,        // Retraso inicial entre reintentos (ms)
    retryBackoff: 1.5,       // Factor de backoff para reintentos
    pauseBetweenChunks: 1000, // Aumentado para evitar rate limiting
    checkpointInterval: 20,  // Guardar checkpoint cada N chunks
    cacheResults: true,      // Usar caché para evitar duplicados
    reserveRetryAttempts: 2, // Intentos específicos para obtener reservas
    reserveRetryDelay: 1500, // Retraso para reintentos de reservas
    pauseBetweenReserveRequests: 300 // Pausa entre solicitudes de reservas
};

// Interfaces
interface AquaPool {
    tokenA: string;
    tokenB: string;
    address: string;
    reserveA?: string;
    reserveB?: string;
    poolType?: string;
    fee?: string;
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

// Funciones para interactuar con el contrato
async function getTokenSetsCount(): Promise<number> {
    try {
        const result = await invokeCustomContract(
            toolkit,
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
            toolkit,
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
            toolkit,
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
async function getPoolType(contract: string): Promise<string> {
    const result = await invokeCustomContract(
        toolkit,
        contract,
        'pool_type',
        [],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    
    return scValToNative(result.result.retval) as string;
}

async function getPoolFee(contract: string): Promise<string> {
    const result = await invokeCustomContract(
        toolkit,
        contract,
        'get_fee_fraction',
        [],
        true,
        Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
    );
    return scValToNative(result.result.retval) as string;
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

// Función mejorada para obtener datos del contrato
async function getPoolReserves(poolAddress: string, poolType?: string): Promise<{reserveA?: string, reserveB?: string, hasLiquidity?: boolean}> {
    return retry(async () => {
        try {
            const server = new rpc.Server(process.env.SOROBAN_ENDPOINT as string, { allowHttp: true });
            
            // Para datos de tipo instancia, usamos scvLedgerKeyContractInstance
            const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();
            
            // Obtener todos los datos de la instancia
            const response = await server.getContractData(poolAddress, instanceKey);
            
            if (response) {
                // Decodificar datos de la instancia
                const storage = response.val.contractData().val().instance().storage();
                
                // Crear un objeto para almacenar todos los valores
                const contractValues: { [key: string]: any } = {};
                
                // Iterar a través del almacenamiento para obtener todos los valores
                storage?.forEach((entry) => {
                    const key = scValToNative(entry.key());
                    const value = scValToNative(entry.val());
                    contractValues[key] = value;
                });
                
                // Verificar si es un pool de tipo stable
                if (poolType === "stable") {
                    // Para pools stable, buscar el array de Reserves
                    const reserves = contractValues["Reserves"] || 
                                    contractValues["reserves"] || 
                                    contractValues["RESERVES"];
                    
                    if (Array.isArray(reserves) && reserves.length >= 2) {
                        console.log(`ℹ️ Pool stable encontrado con reservas: [${reserves[0]}, ${reserves[1]}]`);
                        
                        // Verificar si hay liquidez
                        const hasLiquidity = !!(reserves[0] && reserves[1] && 
                                            (BigInt(reserves[0]) > 0 || BigInt(reserves[1]) > 0));
                        
                        return {
                            reserveA: reserves[0]?.toString(),
                            reserveB: reserves[1]?.toString(),
                            hasLiquidity
                        };
                    } else {
                        console.log(`⚠️ Pool stable sin array de reservas válido: ${poolAddress}`);
                    }
                } else {
                    // Para pools constant_product, buscar nombres individuales
                    const reserveA = contractValues["ReserveA"]?.toString() || 
                                    contractValues["reserve_a"]?.toString() ||
                                    contractValues["reserveA"]?.toString() ||
                                    contractValues["reserve0"]?.toString() ||
                                    contractValues["Reserve0"]?.toString();
                    
                    const reserveB = contractValues["ReserveB"]?.toString() || 
                                    contractValues["reserve_b"]?.toString() ||
                                    contractValues["reserveB"]?.toString() ||
                                    contractValues["reserve1"]?.toString() ||
                                    contractValues["Reserve1"]?.toString();
                    
                    // Verificar si hay liquidez
                    const hasLiquidity = !!(reserveA && reserveB && 
                                        (BigInt(reserveA) > 0 || BigInt(reserveB) > 0));
                    
                    return {
                        reserveA,
                        reserveB,
                        hasLiquidity
                    };
                }
            }
            
            return {};
        } catch (error) {
            console.error(`❌ Error obteniendo reservas para pool ${poolAddress}:`, error);
            return {};
        }
    }, CONFIG.reserveRetryAttempts, CONFIG.reserveRetryDelay, CONFIG.retryBackoff);
}


// Función para registrar pools con error al obtener reservas
function logPoolWithReserveError(pool: AquaPool, error: any): void {
    const errorPath = path.join(__dirname, '../aquapools-reserve-errors.json');
    let errorPools: {pool: AquaPool, error: string}[] = [];
    
    // Cargar archivo existente si existe
    if (fs.existsSync(errorPath)) {
        try {
            const data = fs.readFileSync(errorPath, 'utf8');
            errorPools = JSON.parse(data);
        } catch (error) {
            console.warn('⚠️ Error al cargar el archivo de errores de reservas:', error);
        }
    }
    
    // Añadir pool actual con error
    errorPools.push({
        pool,
        error: error?.toString() || 'Error desconocido'
    });
    
    // Guardar archivo actualizado
    fs.writeFileSync(errorPath, JSON.stringify(errorPools, null, 2));
}

async function processPoolWithReserves(index: number, totalSets: number): Promise<AquaPool | null> {
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
        
        // Obtener tipo de pool primero
        let poolType: string | undefined;
        try {
            poolType = await retry(() => getPoolType(poolAddress), 1);
            if (poolType) {
                poolData.poolType = poolType;
                console.log(`ℹ️ Tipo de pool para ${poolAddress}: ${poolType}`);
            }
        } catch (error) {
            console.warn(`⚠️ No se pudo obtener el tipo de pool para ${poolAddress}`);
        }
        
        // Obtener fee del pool
        try {
            // Pequeña pausa antes de solicitar el fee
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const fee = await retry(() => getPoolFee(poolAddress), 1);
            if (fee) {
                poolData.fee = fee.toString();
                console.log(`💰 Fee del pool ${poolAddress}: ${fee}`);
            }
        } catch (error) {
            console.warn(`⚠️ No se pudo obtener el fee para el pool ${poolAddress}`);
        }
        
        // Obtener reservas con pausa para evitar rate limiting
        try {
            // Pequeña pausa antes de solicitar reservas
            await new Promise(resolve => setTimeout(resolve, CONFIG.pauseBetweenReserveRequests));
            
            // Pasar el tipo de pool a la función getPoolReserves
            const reserves = await getPoolReserves(poolAddress, poolType);
            
            if (reserves.reserveA) poolData.reserveA = reserves.reserveA;
            if (reserves.reserveB) poolData.reserveB = reserves.reserveB;
            
            // Registrar pools sin liquidez en log pero no en archivo
            if (reserves.reserveA === '0' && reserves.reserveB === '0') {
                console.log(`⚠️ Pool sin liquidez: ${poolAddress}`);
            } else if (!reserves.reserveA && !reserves.reserveB) {
                console.log(`⚠️ No se pudieron obtener reservas para: ${poolAddress}`);
                logPoolWithReserveError(poolData, 'No se encontraron valores de reservas');
            }
        } catch (error) {
            console.warn(`⚠️ No se pudieron obtener las reservas para el pool ${poolAddress}`);
            logPoolWithReserveError(poolData, error);
        }
        
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
}

// Función principal
export async function generateAquaPoolsList(): Promise<void> {
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
            
            // Procesar chunk en serie para evitar rate limiting
            const results = [];
            for (const index of chunk) {
                const result = await processPoolWithReserves(index, totalSets);
                if (result) results.push(result);
                
                // Pequeña pausa entre procesamiento de pools
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Añadir todos los resultados válidos a la lista final
            aquaPools.push(...results);
            
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
            
            // Pausa entre chunks (aumentada)
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
    reserveA?: string;
    reserveB?: string;
    poolType?: string;
    fee?: string;
}

export const aquaPoolsList: AquaPool[] = ${JSON.stringify(aquaPools, null, 2)};
`;

        // Asegurar que el directorio existe
        const outputDir = path.join(__dirname, '../../src/mappings');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Escribir archivo
        const filePath = path.join(outputDir, 'aquaPools.ts');
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

        // Generar estadísticas adicionales
        const poolsWithReserves = aquaPools.filter(pool => pool.reserveA && pool.reserveB).length;
        const poolsWithoutReserves = aquaPools.length - poolsWithReserves;
        const poolsWithType = aquaPools.filter(pool => pool.poolType).length;
        const poolsWithFee = aquaPools.filter(pool => pool.fee).length;
        const poolsWithZeroReserves = aquaPools.filter(pool => 
            pool.reserveA === '0' && pool.reserveB === '0'
        ).length;
        
        console.log(`\n📊 Estadísticas de pools:`);
        console.log(`✅ Pools con reservas: ${poolsWithReserves} (${((poolsWithReserves/aquaPools.length)*100).toFixed(2)}%)`);
        console.log(`⚠️ Pools sin reservas: ${poolsWithoutReserves} (${((poolsWithoutReserves/aquaPools.length)*100).toFixed(2)}%)`);
        console.log(`ℹ️ Pools con tipo: ${poolsWithType} (${((poolsWithType/aquaPools.length)*100).toFixed(2)}%)`);
        console.log(`💰 Pools con fee: ${poolsWithFee} (${((poolsWithFee/aquaPools.length)*100).toFixed(2)}%)`);
        console.log(`⚠️ Pools con reservas en cero: ${poolsWithZeroReserves} (${((poolsWithZeroReserves/aquaPools.length)*100).toFixed(2)}%)`);

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