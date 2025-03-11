import { SorobanEvent } from "@subql/types-stellar";
import { initializeDB } from "../intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { extractValuesNewPair } from "../soroswap/helpers/newPairEvent";
import { SoroswapPair } from "../types";

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 Sync event received`);
  await initializeDB();
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 NewPair event received`);
  return await soroswapNewPairHandler(event);
}
