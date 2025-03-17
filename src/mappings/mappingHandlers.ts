import { SorobanEvent } from "@subql/types-stellar";
import { initializeSoroswap } from "../soroswap/intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { phoenixHandler } from "../phoenix";
import { initializePhoenix } from "../phoenix/initialize";
import { cometEventHandler } from "../comet";
import { initializeComet } from "../comet/initialize";
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

// COMET EVENTS
export async function handleCometEvent(event: SorobanEvent): Promise<void> {
  logger.info(
    `[COMET] 🔁 ${String(event.topic[1]?.value()).toUpperCase()} Event received`
  );
  await initializeComet(event.contractId.toString());

  return await cometEventHandler(event);
}

export async function handleNewPoolCometEvent(
  event: SorobanEvent
): Promise<void> {
  logger.info(
    `[COMET] 🔁 ${String(event.topic[1]?.value()).toUpperCase()} Event received`
  );
  await initializeComet(event.contractId.toString());
}
