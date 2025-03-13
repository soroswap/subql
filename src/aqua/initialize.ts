import { AquaPair } from "../types";
import { aquaPoolsList, aquaPoolsGeneratedDate } from "./aquaPools";

const isMainnet = process.env.NETWORK === "mainnet";


export async function initializeAquaDb(contractId: string): Promise<void> {
     // logger.info("🔍 Checking if Phoenix is initialized");
  let xlm = await AquaPair.get(contractId);
  if (xlm) return;

    const failedPools: string[] = [];
    
    try {
        
        // Process in batches to avoid memory overload
        const batchSize = 20;
        for (let i = 0; i < aquaPoolsList.length; i += batchSize) {
            const batch = aquaPoolsList.slice(i, i + batchSize);
            
            // Create or update records for this batch
            const poolPromises = batch.map(async (pool, index) => {
                try {
                    // Try to get the existing pool
                    let aquaPair = await AquaPair.get(pool.address);
                    
                    if (aquaPair) {
                        // Update the existing pool with the new data
                        if (pool.poolType) {
                            aquaPair.poolType = pool.poolType;
                        }
                        
                        if (pool.fee) {
                            aquaPair.fee = BigInt(pool.fee);
                        }
                        
                        if (pool.reserveA) {
                            aquaPair.reserveA = BigInt(pool.reserveA);
                        }
                        
                        if (pool.reserveB) {
                            aquaPair.reserveB = BigInt(pool.reserveB);
                        }
                        
                        await aquaPair.save();
                        logger.info(`[AQUA] 🔄 Updated pool: ${pool.address}`);
                    } else {
                        // Create new record
                        aquaPair = AquaPair.create({
                            id: pool.address,
                            ledger: 0, // Will be updated with real events
                            date: new Date(aquaPoolsGeneratedDate),
                            address: pool.address,
                            tokenA: pool.tokenA,
                            tokenB: pool.tokenB,
                            poolType: pool.poolType || '', // Use value from file or empty string
                            fee: pool.fee ? BigInt(pool.fee) : BigInt(0), // Use value from file or 0
                            reserveA: pool.reserveA ? BigInt(pool.reserveA) : BigInt(0), // Use value from file or 0
                            reserveB: pool.reserveB ? BigInt(pool.reserveB) : BigInt(0)  // Use value from file or 0
                        });
                        
                        await aquaPair.save();
                        logger.info(`[AQUA] ✨ Created new pool: ${pool.address}`);
                    }
                    
                    return pool.address;
                } catch (error) {
                    logger.error(`[AQUA] ❌ Error processing pool ${pool.address}: ${error}`);
                    failedPools.push(pool.address);
                    return null;
                }
            });
            
            // Wait for all operations in the batch to complete
            const results = await Promise.all(poolPromises);
            const successCount = results.filter(Boolean).length;
            
            logger.info(`[AQUA] ✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(aquaPoolsList.length/batchSize)}: ${successCount} pools saved`);
            
            // Small pause between batches to avoid overload
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // For the final summary, simply count the successfully saved pools
        logger.info("\n[AQUA] 📊 Summary of Aqua initialization:");
        logger.info(`[AQUA] ✅ Pools processed successfully: ${aquaPoolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            logger.info(`[AQUA] ❌ Pools with errors (${failedPools.length}):`);
            failedPools.forEach(pool => logger.info(`   - ${pool}`));
        }
        
    } catch (error) {
        logger.error(`[AQUA] ❌ General error initializing Aqua pools: ${error}`);
        throw error;
    }
    
    logger.info("[AQUA] ✅ initialization completed");
} 