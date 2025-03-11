import { AquaPair } from "../../types";
import { aquaPoolsList } from "../../mappings/aquaPools";

export async function initializeAqua(): Promise<void> {
    logger.info("🚀 Inicializando pools de Aqua...");
    const failedPools: string[] = [];
    
    try {
        logger.info(`📊 Procesando ${aquaPoolsList.length} pools de Aqua...`);
        
        // Procesar en lotes para evitar sobrecarga de memoria
        const batchSize = 20;
        for (let i = 0; i < aquaPoolsList.length; i += batchSize) {
            const batch = aquaPoolsList.slice(i, i + batchSize);
            
            // Crear registros para este lote
            const poolPromises = batch.map(async (pool, index) => {
                try {
                    // Verificar si este pool ya existe
                    const existingPool = await AquaPair.get(pool.address);
                    if (existingPool) {
                        return null; // Ya existe, no hacer nada
                    }
                    
                    // Crear nuevo registro
                    const newPool = AquaPair.create({
                        id: pool.address,
                        ledger: 0, // Se actualizará con eventos reales
                        date: new Date(),
                        address: pool.address,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        poolType: '',
                        reserveA: BigInt(0), // Inicializado en 0
                        reserveB: BigInt(0)  // Inicializado en 0
                    });
                    
                    await newPool.save();
                    return pool.address;
                } catch (error) {
                    logger.error(`❌ Error inicializando pool de Aqua ${pool.address}: ${error}`);
                    failedPools.push(pool.address);
                    return null;
                }
            });
            
            // Esperar a que todas las operaciones en el lote se completen
            const results = await Promise.all(poolPromises);
            const successCount = results.filter(Boolean).length;
            
            logger.info(`✅ Procesado lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(aquaPoolsList.length/batchSize)}: ${successCount} pools guardados`);
            
            // Pequeña pausa entre lotes para evitar sobrecarga
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Para el resumen final, simplemente contar los pools guardados con éxito
        logger.info("\n📊 Resumen de inicialización de Aqua:");
        logger.info(`✅ Pools procesados con éxito: ${aquaPoolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            logger.info(`❌ Pools con errores (${failedPools.length}):`);
            failedPools.forEach(pool => logger.info(`   - ${pool}`));
        }
        
    } catch (error) {
        logger.error(`❌ Error general inicializando pools de Aqua: ${error}`);
        throw error;
    }
    
    logger.info("✅ Inicialización de Aqua completada");
} 