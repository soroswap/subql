import { SorobanEvent } from "@subql/types-stellar";
import {
  extractValuesCometEvent,
  updatePairReserves,
} from "./helpers/events";

// This handler works for SWAP, PROVIDE_LIQUIDITY, and WITHDRAW_LIQUIDITY events
export const cometEventHandler = async (event: SorobanEvent) => {
  const eventType = String(event.topic[1]?.value()).toUpperCase();

  
  const contractId = event.contractId.toString();
  const cometData = extractValuesCometEvent(event);
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

    
  } catch (error) {
    logger.error(`[COMET] ❌ Error processing ${eventType} event: ${error}`);
  }
};
