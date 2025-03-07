import { Asset, Networks } from "@stellar/stellar-sdk";
import { pairTokenReservesList } from "./mappings/pairTokenRsv";
import { SoroswapPair } from "./types";

const isMainnet = process.env.NETWORK === "mainnet";

export const initializeDB = async () => {
  logger.info("🔍 Checking if XLM pair exists");
  const xlm = await SoroswapPair.getByTokenA(
    Asset.native().contractId(isMainnet ? Networks.PUBLIC : Networks.TESTNET),
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
