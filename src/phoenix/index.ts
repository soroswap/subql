import { SorobanEvent } from "@subql/types-stellar";
import {
  extractReservesFromPhoenixEvent,
  updatePairReserves,
} from "./helpers/extractReserves";

// This handler works for SWAP, PROVIDE_LIQUIDITY, and WITHDRAW_LIQUIDITY events
export const phoenixHandler = async (event: SorobanEvent) => {
  const eventType = String(event.topic[0]?.value()).toUpperCase();
  const contractId = event.contractId.toString();
  const reserves = extractReservesFromPhoenixEvent(event);

  // Store data into database
  try {
    const currentDate = new Date(event.ledgerClosedAt);
    await updatePairReserves(
      contractId,
      currentDate,
      event.ledger.sequence,
      reserves["reserveA"],
      reserves["reserveB"],
      reserves["reserveLp"]
    );

    logger.info(`[PHOENIX] ✨ Updated reserves for pair ${contractId}`);
  } catch (error) {
    logger.error(`[PHOENIX] ❌ Error processing ${eventType} event: ${error}`);
  }
};
