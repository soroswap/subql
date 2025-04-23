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

    if (!existingPool) {
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
    // Actualizar fee solo si existe
    if (eventData.fee !== undefined) {
      existingPool.fee = eventData.fee;
    }
    
    // Actualizar campos para pools estables si existen
    if (existingPool.poolType === "stable") {
      // Actualizar reserveC si existe
      if (eventData.reserveC !== undefined) {
        existingPool.reserveC = eventData.reserveC;
      }
      
      // Actualizar campos de A
      if (eventData.futureA !== undefined) {
        existingPool.futureA = eventData.futureA;
      }
      if (eventData.futureATime !== undefined) {
        existingPool.futureATime = eventData.futureATime;
      }
      if (eventData.initialA !== undefined) {
        existingPool.initialA = eventData.initialA;
      }
      if (eventData.initialATime !== undefined) {
        existingPool.initialATime = eventData.initialATime;
      }
      
      // Actualizar precisiones si existen
      if (eventData.precisionMulA !== undefined) {
        existingPool.precisionMulA = eventData.precisionMulA;
      }
      if (eventData.precisionMulB !== undefined) {
        existingPool.precisionMulB = eventData.precisionMulB;
      }
      if (eventData.precisionMulC !== undefined) {
        existingPool.precisionMulC = eventData.precisionMulC;
      }
      

      
      // Actualizar tokenC si existe
      if (eventData.tokenC !== undefined) {
        existingPool.tokenC = eventData.tokenC;
      }

      logger.info(`[AQUA] ✨ Updated stable pool parameters for ${eventData.address}`);
    }

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

    // Determinar si es un pool estable o constant_product
    const isStablePool = eventData.poolType === "stable";
    
    // Crear valores por defecto para nuevo pool
    const poolDefaults = {
      id: eventData.address,
      idx: eventData.idx,
      ledger: event.ledger.sequence,
      date: currentDate,
      tokenA: eventData.tokenA,
      tokenB: eventData.tokenB,
      tokenC: eventData.tokenC || "", // Campo para pools estables
      reserveA: BigInt(0),
      reserveB: BigInt(0),
      reserveC: BigInt(0), // Campo para pools estables
      poolType: eventData.poolType,
      fee: BigInt(0),
      futureA: BigInt(0), // Campo para pools estables
      futureATime: BigInt(0), // Campo para pools estables
      initialA: BigInt(0), // Campo para pools estables
      initialATime: BigInt(0), // Campo para pools estables
      precisionMulA: BigInt(0), // Campo para pools estables
      precisionMulB: BigInt(0), // Campo para pools estables
      precisionMulC: BigInt(0), // Campo para pools estables
    };

    // Create record
    const aquaPair = AquaPair.create(poolDefaults);

    await aquaPair.save();
    logger.info(
      `[AQUA] ✅ Pool event created/updated for address: ${eventData.address} (type: ${eventData.poolType})`
    );
  } catch (error) {
    logger.error(`[AQUA] ❌ Error processing Aqua Pool event: ${error}`);
    throw error;
  }
}
