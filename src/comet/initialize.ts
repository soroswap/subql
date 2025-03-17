import { CometPair } from "../types";
import {
  cometPairReservesList,
  cometPairsGeneratedDate,
} from "./pairReservesData";

export const initializeComet = async (contractId: string) => {
  let xlm = await CometPair.get(contractId);
  if (xlm) return;

  const failedPairs: string[] = [];

  try {
    // Iterate over the list of pairs from the pairReservesData.ts file
    for (const [index, pair] of cometPairReservesList.entries()) {
      try {
        // Check if a record already exists for this pair
        const existingPair = await CometPair.get(pair.address);

        if (!existingPair) {
          logger.info(
            `📊 Processing pair ${index + 1}/${cometPairReservesList.length}: ${
              pair.address
            }`
          );

          // Create the initial record with all the information
          const newPair = CometPair.create({
            id: pair.address,
            ledger: 55735990 + index,
            date: new Date(cometPairsGeneratedDate),
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
    logger.info("📊 Initialization summary:");
    logger.info(
      `✅ Successfully processed pairs: ${
        cometPairReservesList.length - failedPairs.length
      }`
    );
    if (failedPairs.length > 0) {
      logger.info(`❌ Pairs with errors (${failedPairs.length}):`);
      failedPairs.forEach((pair) => logger.info(`   - ${pair}`));
    }
  } catch (error) {
    logger.error("❌ General error in initialization:", error);
    throw error;
  }

  logger.info("✅ Initialization completed");
};
