import { SorobanEvent } from "@subql/types-stellar";
import { AquaPair } from "../types";
import { extractAddPoolAquaValues } from "./helpers/addPoolEvent";
import { extractAquaValues } from "./helpers/events";

// AQUA EVENT: SWAP, DEPOSIT, WITHDRAW
export async function aquaEventHandler(event: SorobanEvent): Promise<void> {
  const eventType = event.topic[0]?.value();
  try {
    const eventData = await extractAquaValues(event);

    if (!eventData.address) {
      logger.error(`[AQUA] ❌ No contract address found in event`);
      return;
    }
    // check if contract exist in database
    const existingPool = await AquaPair.get(eventData.address);

    if (!existingPool.id) {
      logger.error(
        `[AQUA] ❌ Error: Pool ${eventData.address} not found, this contract is not a valid AQUA pool`
      );
      return;
    }
    // Check if the event is more recent than existing data
    const currentDate = new Date(event.ledgerClosedAt);
    if (new Date(existingPool.date) > currentDate) {
      logger.info(`[AQUA] ⏭️ Existing pool data is more recent, NOT updating`);
      return;
    }
    // Update the existing record with new data
    existingPool.reserveA = eventData.reserveA;
    existingPool.reserveB = eventData.reserveB;
    existingPool.date = currentDate;
    existingPool.ledger = event.ledger.sequence;
    existingPool.fee = eventData.fee;

    await existingPool.save();
    logger.info(`[AQUA] ✨ Updated reserves for pool ${eventData.address}`);
  } catch (error) {
    logger.error(`[AQUA] ❌ Error processing ${eventType} event: ${error}`);
    throw error;
  }
}

// AQUA ADD POOL EVENTS AQUA PROTOCOL
export async function aquaAddPoolHandler(event: SorobanEvent): Promise<void> {
  try {
    const eventData = extractAddPoolAquaValues(
      JSON.parse(JSON.stringify(event))
    );
    const currentDate = new Date(event.ledgerClosedAt);

    // Check if there is a previous record for this user
    const existingPool = await AquaPair.get(eventData.address);

    // If there is a more recent record, do not update
    if (existingPool && new Date(existingPool.date) > currentDate) {
      logger.info(
        `[AQUA] ⏭️ Existing pool data for contract ${eventData.address} is more recent, NOT updating`
      );
      return;
    }

    // Create or update record
    const aquaPair = AquaPair.create({
      id: eventData.address,
      ledger: event.ledger.sequence,
      date: currentDate,
      tokenA: eventData.tokenA,
      tokenB: eventData.tokenB,
      reserveA: BigInt(0), // Initialized in 0
      reserveB: BigInt(0), // Initialized in 0
      poolType: eventData.poolType,
      fee: BigInt(0),
    });

    await aquaPair.save();
    logger.info(
      `[AQUA] ✅ Pool event created/updated for address: ${eventData.address}`
    );
  } catch (error) {
    logger.error(`[AQUA] ❌ Error processing Aqua Pool event: ${error}`);
    throw error;
  }
}
