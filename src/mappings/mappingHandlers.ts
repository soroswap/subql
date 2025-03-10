import { SorobanEvent } from "@subql/types-stellar";
import { SoroswapPair } from "../types";
import { extractValuesNewPair } from "../soroswap/helpers/newPairEvent";
import { soroswapSyncHandler } from "../soroswap";
import { initializeDB } from "../intialize";

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
  logger.info(`🔁 NewPair event received`);
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
