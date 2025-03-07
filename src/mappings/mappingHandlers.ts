import { SorobanEvent } from "@subql/types-stellar";
import { config } from "dotenv";
import { pairTokenReservesList } from "./pairTokenRsv";
import { SoroswapPair } from "../types";
import { extractValuesNewPair } from "../soroswap/helpers/newPairEvent";
import { soroswapSyncHandler } from "../soroswap";
import { initializeDB } from "../intialize";

config();

let initialized = false;

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  await initializeDB();
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
