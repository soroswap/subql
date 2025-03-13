import { SorobanEvent } from "@subql/types-stellar";
import { AquaPair } from "../types";
import { extractDepositAquaValues } from "./helpers/depositEvent";
import { extractAddPoolAquaValues } from "./helpers/addPoolEvent";
import { extractWithdrawAquaValues } from "./helpers/withdrawEvent";
import { extractSwapAquaValues } from "./helpers/swapEvent";
// AQUA SWAP LIQUIDITY EVENTS
export async function aquaSwapHandler(event: SorobanEvent): Promise<void> {
    try {    
        const swapData = await extractSwapAquaValues(JSON.parse(JSON.stringify(event)));
        if (!swapData.address) {
            logger.error(`[AQUA] ❌ No contract address found in deposit event`);
            return;
        }
        // Look for the pool in the database
        const existingPool = await AquaPair.get(swapData.address);
        if (!existingPool) {
            logger.info(`[AQUA] ⚠️ Pool ${swapData.address} not found in database, creating new record`);
            
            // Create a new record if it doesn't exist
            const newPool = AquaPair.create({
                id: swapData.address,
                ledger: event.ledger.sequence,
                date: new Date(event.ledgerClosedAt),
                address: swapData.address,
                tokenA: swapData.tokenA,
                tokenB: swapData.tokenB,
                poolType: 'unknown', // We could get this from another source
                fee: BigInt(0),
                reserveA: swapData.reserveA || BigInt(0),
                reserveB: swapData.reserveB || BigInt(0)
            });
            
            await newPool.save();
            logger.info(`[AQUA] ✅ Created new pool record for ${swapData.address}`);
            return;
        }
        
        // Check if the event is more recent than existing data
        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(existingPool.date) > currentDate) {
            logger.info(`[AQUA] ⏭️ Existing pool data is more recent, NOT updating`);
            return;
        }
        
        // Update the existing record with new data
        existingPool.reserveA = swapData.reserveA;
        existingPool.reserveB = swapData.reserveB;
        existingPool.date = currentDate;
        existingPool.ledger = event.ledger.sequence;
        existingPool.fee = swapData.fee;
    
        await existingPool.save();
        logger.info(`[AQUA] ✨ Updated reserves for pool ${swapData.address}`);
        
    } catch (error) {
        logger.error(`[AQUA] ❌ Error processing Aqua swap event: ${error}`);
        throw error;
    }}


// AQUA WITHDRAW LIQUIDITY EVENTS
export async function aquaWithdrawHandler(event: SorobanEvent): Promise<void> {
try {    
    const withdrawData = await extractWithdrawAquaValues(JSON.parse(JSON.stringify(event)));
    if (!withdrawData.address) {
        logger.error(`[AQUA] ❌ No contract address found in deposit event`);
        return;
    }
    // Look for the pool in the database
    const existingPool = await AquaPair.get(withdrawData.address);
    if (!existingPool) {
        logger.info(`[AQUA] ⚠️ Pool ${withdrawData.address} not found in database, creating new record`);
        
        // Create a new record if it doesn't exist
        const newPool = AquaPair.create({
            id: withdrawData.address,
            ledger: event.ledger.sequence,
            date: new Date(event.ledgerClosedAt),
            address: withdrawData.address,
            tokenA: withdrawData.tokenA,
            tokenB: withdrawData.tokenB,
            poolType: 'unknown', // We could get this from another source
            fee: BigInt(0),
            reserveA: withdrawData.reserveA || BigInt(0),
            reserveB: withdrawData.reserveB || BigInt(0)
        });
        
        await newPool.save();
        logger.info(`[AQUA] ✅ Created new pool record for ${withdrawData.address}`);
        return;
    }
    
    // Check if the event is more recent than existing data
    const currentDate = new Date(event.ledgerClosedAt);
    if (new Date(existingPool.date) > currentDate) {
        logger.info(`[AQUA] ⏭️ Existing pool data is more recent, NOT updating`);
        return;
    }
    
    // Update the existing record with new data
    existingPool.reserveA = withdrawData.reserveA;
    existingPool.reserveB = withdrawData.reserveB;
    existingPool.date = currentDate;
    existingPool.ledger = event.ledger.sequence;
    existingPool.fee = withdrawData.fee;

    await existingPool.save();
    logger.info(`[AQUA] ✨ Updated reserves for pool ${withdrawData.address}`);
    
} catch (error) {
    logger.error(`[AQUA] ❌ Error processing Aqua withdraw event: ${error}`);
    throw error;
}}

// AQUA DEPOSIT LIQUIDITY EVENTS
export async function aquaDepositHandler(event: SorobanEvent): Promise<void> {
    try {
        logger.info(`[AQUA] 🔄 Processing AQUA DEPOSIT LIQUIDITY EVENT`);
        // Extract data from the event
        const depositData = await extractDepositAquaValues(JSON.parse(JSON.stringify(event)));
        
        // Check if we have the contract address
        if (!depositData.address) {
            logger.error(`[AQUA] ❌ No contract address found in deposit event`);
            return;
        }
        // Look for the pool in the database
        const existingPool = await AquaPair.get(depositData.address);
        if (!existingPool) {
            logger.info(`[AQUA] ⚠️ Pool ${depositData.address} not found in database, creating new record`);
            
            // Create a new record if it doesn't exist
            const newPool = AquaPair.create({
                id: depositData.address,
                ledger: event.ledger.sequence,
                date: new Date(event.ledgerClosedAt),
                address: depositData.address,
                tokenA: depositData.tokenA,
                tokenB: depositData.tokenB,
                poolType: 'unknown', // We could get this from another source
                fee: BigInt(0),
                reserveA: depositData.reserveA || BigInt(0),
                reserveB: depositData.reserveB || BigInt(0)
            });
            
            await newPool.save();
            logger.info(`[AQUA] ✅ Created new pool record for ${depositData.address}`);
            return;
        }
        
        // Check if the event is more recent than existing data
        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(existingPool.date) > currentDate) {
            logger.info(`[AQUA] ⏭️ Existing pool data is more recent, NOT updating`);
            return;
        }
        
        // Update the existing record with new data
        existingPool.reserveA = depositData.reserveA;
        existingPool.reserveB = depositData.reserveB;
        existingPool.date = currentDate;
        existingPool.ledger = event.ledger.sequence;
        existingPool.fee = depositData.fee;
    
        await existingPool.save();
        logger.info(`[AQUA] ✨ Updated reserves for pool ${depositData.address}`);
        
    } catch (error) {
        logger.error(`[AQUA] ❌ Error processing Aqua deposit event: ${error}`);
        throw error;
    }
}

// AQUA ADD POOL EVENTS AQUA PROTOCOL
export async function aquaAddPoolHandler(event: SorobanEvent): Promise<void> {

    try {
        const eventData = extractAddPoolAquaValues(JSON.parse(JSON.stringify(event)));
        const currentDate = new Date(event.ledgerClosedAt);

        // Check if there is a previous record for this user
        const existingPool = await AquaPair.get(eventData.address);
        
        // If there is a more recent record, do not update
        if (existingPool && new Date(existingPool.date) > currentDate) {
            logger.info(`[AQUA] ⏭️ Existing pool data for contract ${eventData.address} is more recent, NOT updating`);
            return;
        }

        // Create or update record
        const aquaPair = AquaPair.create({
            id: eventData.address,
            ledger: event.ledger.sequence,
            date: currentDate,
            address: eventData.address,
            tokenA: eventData.tokenA,
            tokenB: eventData.tokenB,
            poolType: eventData.poolType,
            fee: BigInt(0),
            reserveA: BigInt(0), // Initialized in 0
            reserveB: BigInt(0)  // Initialized in 0
        });

        await aquaPair.save();
        logger.info(`[AQUA] ✅ Pool event created/updated for address: ${eventData.address}`);

    } catch (error) {
        logger.error(`[AQUA] ❌ Error processing Aqua Pool event: ${error}`);
        throw error;
    }
}
