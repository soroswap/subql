import { SorobanEvent } from "@subql/types-stellar";
import { initializeSoroswap } from "../soroswap/intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { phoenixSwapHandler } from "../phoenix";
import { initializePhoenix } from "../phoenix/initialize";

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 Sync event received`);
  await initializeSoroswap();
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 NewPair event received`);
  return await soroswapNewPairHandler(event);
}

// PHOENIX EVENTS
export async function handlePhoenixSwapEvent(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔁 Phoenix Event received`);
  await initializePhoenix();
  return await phoenixSwapHandler(event);
}
