import { pairTokenReservesList } from "./mappings/pairTokenRsv";
import { SoroswapPair } from "./types";
import { AquaPair } from "./types";
import { aquaPoolsList } from "./mappings/aquaPools";

const isMainnet = process.env.NETWORK === "mainnet";

export const initializeDB = async () => {
  logger.info("🔍 Checking if XLM pair exists");
  const xlm = await SoroswapPair.getByTokenA(
    isMainnet
      ? "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
      : "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    { limit: 1 }
  );

  if (xlm.length >= 1) return;

  const failedPairs: string[] = [];

  try {
    // Iterate over the list of pairs from the pairTokenRsv.ts file
    for (const [index, pair] of pairTokenReservesList.entries()) {
      try {
        // Check if a record already exists for this pair
        const existingPair = await SoroswapPair.get(pair.address);

        if (!existingPair) {
          logger.info(
            `📊 Processing pair ${index + 1}/${pairTokenReservesList.length}: ${
              pair.address
            }`
          );

          // Create the initial record with all the information
          const newPair = SoroswapPair.create({
            id: pair.address,
            ledger: 55735990 + index,
            date: new Date(Date.now()),
            tokenA: pair.token_a,
            tokenB: pair.token_b,
            reserveA: BigInt(pair.reserve_a),
            reserveB: BigInt(pair.reserve_b),
          });

          await newPair.save();
          logger.info(`✨ Pair initialized: ${pair.address}`);

          // Small pause between each pair
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`❌ Error initializing pair ${pair.address}: ${error}`);
        failedPairs.push(pair.address);
      }
    }

    // Final summary
    logger.info("\n📊 Initialization summary:");
    logger.info(
      `✅ Successfully processed pairs: ${
        pairTokenReservesList.length - failedPairs.length
      }`
    );
    if (failedPairs.length > 0) {
      logger.info(`❌ Pares with errors (${failedPairs.length}):`);
      failedPairs.forEach((pair) => logger.info(`   - ${pair}`));
    }
  } catch (error) {
    logger.error("❌ General error in initialization:", error);
    throw error;
  }

  logger.info("✅ Initialization completed");
};



export async function initializeAquaDb(): Promise<void> {
    logger.info("🚀 Inicializando pools de Aqua...");
    logger.info("🔍 Checking if XLM pair exists");
    const xlm = await AquaPair.getByTokenB(
      isMainnet
        ? "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
        : "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      { limit: 1 }
    );
  
    if (xlm.length >= 1) return;
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
                        // Actualizar campos si el pool ya existe pero faltan datos
                        if (pool.poolType && !existingPool.poolType) {
                            existingPool.poolType = pool.poolType;
                            await existingPool.save();
                            logger.info(`🔄 Actualizado tipo de pool para ${pool.address}: ${pool.poolType}`);
                        }
                        
                        if (pool.fee && existingPool.fee === BigInt(0)) {
                            existingPool.fee = BigInt(pool.fee);
                            await existingPool.save();
                            logger.info(`🔄 Actualizado fee para ${pool.address}: ${pool.fee}`);
                        }
                        
                        if (pool.reserveA && existingPool.reserveA === BigInt(0)) {
                            existingPool.reserveA = BigInt(pool.reserveA);
                            await existingPool.save();
                            logger.info(`🔄 Actualizada reserveA para ${pool.address}: ${pool.reserveA}`);
                        }
                        
                        if (pool.reserveB && existingPool.reserveB === BigInt(0)) {
                            existingPool.reserveB = BigInt(pool.reserveB);
                            await existingPool.save();
                            logger.info(`🔄 Actualizada reserveB para ${pool.address}: ${pool.reserveB}`);
                        }
                        
                        return null; // Ya existe, no crear nuevo
                    }
                    
                    // Crear nuevo registro con todos los campos disponibles
                    const newPool = AquaPair.create({
                        id: pool.address,
                        ledger: 0, // Se actualizará con eventos reales
                        date: new Date(),
                        address: pool.address,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        poolType: pool.poolType || '', // Usar valor del archivo o cadena vacía
                        fee: pool.fee ? BigInt(pool.fee) : BigInt(0), // Usar valor del archivo o 0
                        reserveA: pool.reserveA ? BigInt(pool.reserveA) : BigInt(0), // Usar valor del archivo o 0
                        reserveB: pool.reserveB ? BigInt(pool.reserveB) : BigInt(0)  // Usar valor del archivo o 0
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