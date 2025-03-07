import { StrKey } from "@stellar/stellar-sdk";
import { SorobanEvent } from "@subql/types-stellar";
import { SoroswapPair } from "../types";
import { extractReserves } from "./helpers/syncEvent";

export const soroswapSyncHandler = async (event: SorobanEvent) => {
  // if (!initialized) {
  //     await initialize();
  //     initialized = true;
  // }
  // get contract address
  const address = event.contractId?.contractId().toString();
  if (!StrKey.isValidContract(address)) {
    logger.info(`🔴 Error: Invalid contract address`);
    return;
  }
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
    logger.info(`✨ Updated reserves for pair ${address}`);
  } catch (error) {
    logger.error(`❌🔴🔴 Error processing sync event: ${error}`);
    throw error;
  }
};
