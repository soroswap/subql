import { SorobanEvent } from "@subql/types-stellar";
import { initializeDB } from "../intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";

// Importar las funciones de Aqua
import { aquaDepositHandler, aquaAddPoolHandler } from "../aqua";

// Default Soroban endpoint


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


// AQUA DEPOSIT LIQUIDITY EVENTS
export async function handleEventDepositAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔄 Aqua deposit event received`);
  return await aquaDepositHandler(event);
}

// AQUA ADD POOL EVENTS
export async function handleEventAddPoolAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`🔄 Aqua add pool event received`);
  return await aquaAddPoolHandler(event);
}
