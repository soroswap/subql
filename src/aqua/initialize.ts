import { AquaPair } from "../types";
import { aquaPoolsList, aquaPoolsGeneratedDate } from "./aquaPools";

export async function initializeAquaDb(contractId: string): Promise<void> {
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

            if (pool.reserveC) {
              aquaPair.reserveC = BigInt(pool.reserveC);
            }

            if (pool.futureA) {
              aquaPair.futureA = BigInt(pool.futureA);
            }

            if (pool.futureATime) {
              aquaPair.futureATime = BigInt(pool.futureATime);
            }

            if (pool.initialA) {
              aquaPair.initialA = BigInt(pool.initialA);
            }

            if (pool.initialATime) {
              aquaPair.initialATime = BigInt(pool.initialATime);
            }

            if (pool.precisionMulA) {
              aquaPair.precisionMulA = BigInt(pool.precisionMulA);
            }

            if (pool.precisionMulB) {
              aquaPair.precisionMulB = BigInt(pool.precisionMulB);
            }

            if (pool.precisionMulC) {
              aquaPair.precisionMulC = BigInt(pool.precisionMulC);
            }

            if (pool.idx) {
              aquaPair.idx = pool.idx;
            }

            await aquaPair.save();
            logger.info(`[AQUA] 🔄 Updated pool: ${pool.address}`);
          } else {
            // Create new record
            aquaPair = AquaPair.create({
              id: pool.address,
              ledger: 0, // Will be updated with real events
              date: new Date(aquaPoolsGeneratedDate),
              idx: pool.idx,
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              tokenC: pool.tokenC || "", // Default value for non-stable pools
              reserveA: pool.reserveA ? BigInt(pool.reserveA) : BigInt(0),
              reserveB: pool.reserveB ? BigInt(pool.reserveB) : BigInt(0),
              reserveC: pool.reserveC ? BigInt(pool.reserveC) : BigInt(0), // Default value
              poolType: pool.poolType || "",
              fee: pool.fee ? BigInt(pool.fee) : BigInt(0),
              // Fields for stable pools
              futureA: pool.futureA ? BigInt(pool.futureA) : BigInt(0),
              futureATime: pool.futureATime ? BigInt(pool.futureATime) : BigInt(0),
              initialA: pool.initialA ? BigInt(pool.initialA) : BigInt(0),
              initialATime: pool.initialATime ? BigInt(pool.initialATime) : BigInt(0),
              precisionMulA: pool.precisionMulA ? BigInt(pool.precisionMulA) : BigInt(1),
              precisionMulB: pool.precisionMulB ? BigInt(pool.precisionMulB) : BigInt(1),
              precisionMulC: pool.precisionMulC ? BigInt(pool.precisionMulC) : BigInt(1)
            });

            await aquaPair.save();
            logger.info(`[AQUA] ✨ Created new pool: ${pool.address}`);
          }

          return pool.address;
        } catch (error) {
          logger.error(
            `[AQUA] ❌ Error processing pool ${pool.address}: ${error}`
          );
          failedPools.push(pool.address);
          return null;
        }
      });

      // Wait for all operations in the batch to complete
      const results = await Promise.all(poolPromises);
      const successCount = results.filter(Boolean).length;

      logger.info(
        `[AQUA] ✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          aquaPoolsList.length / batchSize
        )}: ${successCount} pools saved`
      );

      // Small pause between batches to avoid overload
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // For the final summary, simply count the successfully saved pools
    logger.info("\n[AQUA] 📊 Summary of Aqua initialization:");
    logger.info(
      `[AQUA] ✅ Pools processed successfully: ${
        aquaPoolsList.length - failedPools.length
      }`
    );
    if (failedPools.length > 0) {
      logger.info(`[AQUA] ❌ Pools with errors (${failedPools.length}):`);
      failedPools.forEach((pool) => logger.info(`   - ${pool}`));
    }
  } catch (error) {
    logger.error(`[AQUA] ❌ General error initializing Aqua pools: ${error}`);
    throw error;
  }

  logger.info("[AQUA] ✅ initialization completed");
}
