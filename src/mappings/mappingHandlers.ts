import { SorobanEvent } from "@subql/types-stellar";
import { initializeSoroswap } from "../soroswap/intialize";
import { soroswapNewPairHandler, soroswapSyncHandler } from "../soroswap";
import { phoenixHandler } from "../phoenix";
import { initializePhoenix } from "../phoenix/initialize";
import { initializeAquaDb } from "../aqua/initialize";
import { aquaEventHandler, aquaAddPoolHandler } from "../aqua";
import { getFactoryTopic } from "../aqua/helpers/events";
import { getAquaFactory, NETWORK } from "../constants";
import * as DefindexHandler from "../defindex"; // TEMP: DEFINDEX EVENTS
import { initializeDeFindexDB } from "../defindex/initialize"; // TEMP: DEFINDEX INIT

// SOROSWAP SYNC EVENTS
export async function handleSoroswapEventSync(event: SorobanEvent): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 Sync event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapSyncHandler(event);
}

// SOROSWAP PAIR EVENTS
export async function handleSoroswapEventNewPair(event: SorobanEvent): Promise<void> {
  logger.info(`[SOROSWAP] 🔁 NewPair event received`);
  await initializeSoroswap(event.contractId.toString());
  return await soroswapNewPairHandler(event);
}

// PHOENIX EVENTS
export async function handlePhoenixEvent(event: SorobanEvent): Promise<void> {
  logger.info(`[PHOENIX] 🔁 ${String(event.topic[0]?.value()).toUpperCase()} Event received`);
  await initializePhoenix(event.contractId.toString());
  return await phoenixHandler(event);
}

export async function handlePhoenixCreateLPEvent(event: SorobanEvent): Promise<void> {
  logger.info(`[PHOENIX] 🔁 Create LP Event received`);
  // TODO: Create lp handler
}

// AQUA SWAP LIQUIDITY EVENTS
export async function handleEventAqua(event: SorobanEvent): Promise<void> {
  logger.info(`[AQUA] 🔁 ${String(event.topic[0]?.value()).toUpperCase()} Event received`);
  const factoryAddress = await getFactoryTopic(event);
  if (String(event.topic[0]?.value()).toUpperCase() === "TRADE" && (factoryAddress === getAquaFactory(NETWORK.MAINNET) || factoryAddress === getAquaFactory(NETWORK.TESTNET))) {
    await initializeAquaDb(event.contractId.toString());
  }

  return await aquaEventHandler(event);
}

// AQUA ADD POOL EVENTS
export async function handleEventAddPoolAqua(event: SorobanEvent): Promise<void> {
  logger.info(`[AQUA] 🔄 add pool event received`);
  return await aquaAddPoolHandler(event);
}

///////////////////////////////////////////////
// TEMP: DEFINDEX EVENTS
export async function handleDefindexDepositEvent(event: SorobanEvent): Promise<void> {
  logger.info(`[DEFINDEX] 🔁 ${String(event.topic[0]?.value()).toUpperCase()} ${String(event.topic[1]?.value()).toUpperCase()} Event received`);
  await initializeDeFindexDB(event.contractId.toString());
  return await DefindexHandler.defindexEventHandler(event);
}

export async function handleDefindexWithdrawEvent(event: SorobanEvent): Promise<void> {
  logger.info(`[DEFINDEX] 🔁 ${String(event.topic[0]?.value()).toUpperCase()} ${String(event.topic[1]?.value()).toUpperCase()} Event received`);
  await initializeDeFindexDB(event.contractId.toString());
  return await DefindexHandler.defindexEventHandler(event);
}
// END TEMP: DEFINDEX EVENTS
///////////////////////////////////////////////
