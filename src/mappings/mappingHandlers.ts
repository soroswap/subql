import { SorobanEvent } from "@subql/types-stellar";
import { config } from "dotenv";
import { pairTokenReservesList } from "./pairTokenRsv";
import { SoroswapPair } from "../types";
import { extractValuesNewPair } from "../soroswap/helpers/newPairEvent";
import { soroswapSyncHandler } from "../soroswap";

config();

let initialized = false;

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  try {
    const { tokenA, tokenB, address } = extractValuesNewPair(
      JSON.parse(JSON.stringify(event))
    );

    // Crear nuevo par o actualizar si existe
    const existingPair = await SoroswapPair.get(address);
    const currentDate = new Date(event.ledgerClosedAt);

    if (existingPair && new Date(existingPair.date) > currentDate) {
      logger.info(`⏭️ Existing pair data is more recent, NOT updating`);
      return;
    }

    const pair = SoroswapPair.create({
      id: address,
      ledger: event.ledger.sequence,
      date: currentDate,
      tokenA: tokenA,
      tokenB: tokenB,
      reserveA: existingPair ? existingPair.reserveA : BigInt(0),
      reserveB: existingPair ? existingPair.reserveB : BigInt(0),
    });

    await pair.save();
    logger.info(`✅ Pair ${address} created/updated`);
  } catch (error) {
    logger.error(`❌🔴🔴 Error processing NewPair event: ${error}`);
    throw error;
  }
}

//######################### HELPERS #########################

async function initialize(): Promise<void> {
  logger.info("🚀 Initializing pairs...");
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
}

// // Modified function to get reserves from poolRsvList
// async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
//     try {
//         // Search for the pool in the reserves list
//         const pool = poolReservesList.find(p => p.contract === contractId);

//         if (!pool) {
//             logger.warn(`⚠️ No reserves found for pool ${contractId} in poolRsvList`);
//             return [BigInt(0), BigInt(0)];
//         }

//         logger.info(`✅ Reserves found for ${contractId}:`);
//         logger.info(`Reserve0: ${pool.reserve0}`);
//         logger.info(`Reserve1: ${pool.reserve1}`);

//         return [BigInt(pool.reserve0), BigInt(pool.reserve1)];

//     } catch (error) {
//         logger.error(`❌🔴🔴 Error getting reserves for ${contractId}: ${error}`);
//         logger.warn(`⚠️ Using default values for pool ${contractId}`);

//         return [BigInt(0), BigInt(0)];
//     }
// }

// async function checkAndGetAccount(
//   id: string,
//   ledgerSequence: number
// ): Promise<Account> {
//   let account = await Account.get(id.toLowerCase());
//   if (!account) {
//     // We couldn't find the account
//     account = Account.create({
//       id: id.toLowerCase(),
//       firstSeenLedger: ledgerSequence,
//     });
//   }
//   return account;
// }

// scValToNative not works, temp solution
// function decodeAddress(scVal: xdr.ScVal): string {
//   try {
//     return Address.account(scVal.address().accountId().ed25519()).toString();
//   } catch (e) {
//     return Address.contract(scVal.address().contractId()).toString();
//   }
// }
