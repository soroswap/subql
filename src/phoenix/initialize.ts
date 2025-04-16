import {
  phoenixPairReservesList,
  phoenixPairsGeneratedDate,
} from "./pairReservesData";
import { PhoenixPair } from "../types";

const isMainnet = process.env.NETWORK === "mainnet";

export const initializePhoenix = async (contractId: string) => {
  // logger.info("🔍 Checking if Phoenix is initialized");
  let xlm = await PhoenixPair.get(contractId);
  if (xlm) return;

  const failedPairs: string[] = [];

  try {
    // Iterate over the list of pairs from the pairReservesData.ts file
    for (const [index, pair] of phoenixPairReservesList.entries()) {
      try {
        // Check if a record already exists for this pair
        const existingPair = await PhoenixPair.get(pair.address);

        if (!existingPair) {
          logger.info(
            `📊 Processing pair ${index + 1}/${
              phoenixPairReservesList.length
            }: ${pair.address}`
          );

          // Create the initial record with all the information
          const newPair = PhoenixPair.create({
            id: pair.address,
            ledger: 55735990 + index,
            date: new Date(phoenixPairsGeneratedDate),
            tokenA: pair.token_a,
            tokenB: pair.token_b,
            reserveA: BigInt(pair.reserve_a),
            reserveB: BigInt(pair.reserve_b),
            reserveLp: BigInt(pair.reserve_lp),
            stakeAddress: pair.stake_address,
            totalFeeBps: Number(pair.total_fee_bps),
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
        phoenixPairReservesList.length - failedPairs.length
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
