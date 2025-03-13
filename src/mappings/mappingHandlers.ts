import { SorobanEvent } from "@subql/types-stellar";
import { initializeSoroswap } from "../soroswap/intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { phoenixHandler } from "../phoenix";
import { initializePhoenix } from "../phoenix/initialize";
import { initializeAquaDb } from "../aqua/initialize";
import { aquaEventHandler, aquaAddPoolHandler } from "../aqua";

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 Sync event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 NewPair event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapNewPairHandler(event);
}

// PHOENIX EVENTS
export async function handlePhoenixEvent(event: SorobanEvent): Promise<void> {
  logger.info(
    `[PHOENIX] 🔁 ${String(
      event.topic[0]?.value()
    ).toUpperCase()} Event received`
  );
  await initializePhoenix(event.contractId.toString());
  return await phoenixHandler(event);
}

export async function handlePhoenixCreateLPEvent(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[PHOENIX] 🔁 Create LP Event received`);
  // TODO: Create lp handler
}


// // AQUA DEPOSIT LIQUIDITY EVENTS
// export async function handleEventDepositAqua(
//   event: SorobanEvent
// ): Promise<void> {
//   logger.info(`[AQUA] 🔄 deposit event received`);
//   await initializeAquaDb(event.contractId.toString());
//   return await aquaDepositHandler(event);
// }

// // AQUA WITHDRAW LIQUIDITY EVENTS
// export async function handleEventWithdrawAqua(
//   event: SorobanEvent
// ): Promise<void> {
//   logger.info(`[AQUA] 🔄 withdraw event received`);
//   await initializeAquaDb(event.contractId.toString());
//   return await aquaWithdrawHandler(event);
// }

// AQUA SWAP LIQUIDITY EVENTS
export async function handleEventAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `[AQUA] 🔁 ${String(
      event.topic[0]?.value()
    ).toUpperCase()} Event received`
  );
  await initializeAquaDb(event.contractId.toString());
  return await aquaEventHandler(event);
}

// AQUA ADD POOL EVENTS
export async function handleEventAddPoolAqua(
  event: SorobanEvent
): Promise<void> {
  logger.info(`[AQUA] 🔄 add pool event received`);
  await initializeAquaDb(event.contractId.toString());
  return await aquaAddPoolHandler(event);
}
