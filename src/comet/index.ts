import { SorobanEvent } from "@subql/types-stellar";
import {
  extractValuesCometEvent,
  updatePairReserves,
} from "./helpers/events";

// This handler works for SWAP, PROVIDE_LIQUIDITY, and WITHDRAW_LIQUIDITY events
export const cometEventHandler = async (event: SorobanEvent) => {
  const eventType = String(event.topic[1]?.value()).toUpperCase();

  
  const contractId = event.contractId.toString();
  logger.info(`[COMET] 🔍 Contract ID: ${contractId}`);
  const cometData = extractValuesCometEvent(event);
  logger.info(`[COMET] 🔍 cometData: ${cometData}`);
    // Store data into database
  try {
    const currentDate = new Date(event.ledgerClosedAt);
    await updatePairReserves(
      cometData.id,
      currentDate,
      event.ledger.sequence,
      cometData.tokenA,
      cometData.tokenB,
      BigInt(cometData.reserveA),
      BigInt(cometData.reserveB)
    );

    logger.info(`[COMET] ✨ Updated reserves for pair ${cometData.id}`);
  } catch (error) {
    logger.error(`[COMET] ❌ Error processing ${eventType} event: ${error}`);
  }
};
