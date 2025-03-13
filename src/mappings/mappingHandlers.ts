import { SorobanEvent } from "@subql/types-stellar";
import { initializeDB } from "../intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { initializeAquaDb } from "../aqua/initialize";
// Importar las funciones de Aqua
import { aquaDepositHandler, aquaAddPoolHandler, aquaWithdrawHandler } from "../aqua";

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
  logger.info(`[AQUA] 🔄 deposit event received`);
  await initializeAquaDb(event.contractId.toString());
  return await aquaDepositHandler(event);
}

// AQUA WITHDRAW LIQUIDITY EVENTS
export async function handleEventWithdrawAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[AQUA] 🔄 withdraw event received`);
  await initializeAquaDb(event.contractId.toString());
  return await aquaWithdrawHandler(event);
}

// AQUA ADD POOL EVENTS
export async function handleEventAddPoolAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[AQUA] 🔄 add pool event received`);
  await initializeAquaDb(event.contractId.toString());
  return await aquaAddPoolHandler(event);
}
