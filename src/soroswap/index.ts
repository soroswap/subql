import { SorobanEvent } from "@subql/types-stellar";
import { SoroswapPair } from "../types";
import { extractReserves } from "./helpers/syncEvent";
import { extractValuesNewPair } from "./helpers/newPairEvent";
// import { extractValuesNewPair } from "./helpers/newPairEvent";

export const soroswapSyncHandler = async (event: SorobanEvent) => {
  const address = event.contractId?.contractId().toString();
  // if (!StrKey.isValidContract(address)) {
  //   logger.info(`🔴 Error: Invalid contract address`);
  //   return;
  // }
  // get pair from database and check if it exists
  const existingPair = await SoroswapPair.get(address);
  if (!existingPair) {
    logger.info(
      `🔴 Error: Contract ${address} was not deployed by Soroswap Factory`
    );
    return;
  }

  try {
    const { reserveA, reserveB } = extractReserves(
      JSON.parse(JSON.stringify(event))
    );

    const currentDate = new Date(event.ledgerClosedAt);
    if (new Date(existingPair.date) > currentDate) {
      logger.info(`⏭️ Existing data is more recent, NOT updating`);
      return;
    }

    // Actualizar solo las reservas y la fecha
    existingPair.reserveA = reserveA;
    existingPair.reserveB = reserveB;
    existingPair.date = currentDate;
    existingPair.ledger = event.ledger.sequence;

    await existingPair.save();
    logger.info(`[SOROSWAP] ✨ Updated reserves for pair ${address}`);
  } catch (error) {
    logger.error(`[SOROSWAP] ❌ Error processing sync event: ${error}`);
    throw error;
  }
};

export const soroswapNewPairHandler = async (event: SorobanEvent) => {
  try {
    const { tokenA, tokenB, address } = extractValuesNewPair(
      JSON.parse(JSON.stringify(event))
    );

    // Crear nuevo par o actualizar si existe
    const existingPair = await SoroswapPair.get(address);
    const currentDate = new Date(event.ledgerClosedAt);

    if (existingPair && new Date(existingPair.date) > currentDate) {
      logger.info(
        `[SOROSWAP] ⏭️ Existing pair data is more recent, NOT updating`
      );
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
    logger.info(`[SOROSWAP] ✅ Pair ${address} created/updated`);
  } catch (error) {
    logger.error(`[SOROSWAP] ❌ Error processing NewPair event: ${error}`);
    throw error;
  }
};
