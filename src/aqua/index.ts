import { SorobanEvent } from "@subql/types-stellar";
import { AquaPair } from "../types";
import { extractDepositAquaValues } from "./helpers/depositEvent";
import { extractAddPoolAquaValues } from "./helpers/addPoolEvent";
import { hexToSorobanAddress, getContractDataFetch, getLedgerKeyContractCode } from "./helpers/utils";
import { initializeAqua } from "./helpers/initialize";

// Variable para controlar la inicialización
let aquaInitialized = false;

// AQUA DEPOSIT LIQUIDITY EVENTS
export async function aquaDepositHandler(event: SorobanEvent): Promise<void> {
    logger.info(`🔄 🔴🔴🔴🔴 AQUA DEPOSIT LIQUIDITY EVENTS`);
    if (!aquaInitialized) {
        await initializeAqua();
        aquaInitialized = true;
    }
    // // 1. Test for error example with Incomplete Data
    // try {
    //     const test = event.value;
    //     logger.info(`🔍 🔴🔴🔴🔴 test: ${JSON.stringify(test)}`);
    //     logger.info(`🔍 🔴🔴🔴🔴 testTransaction: ${JSON.stringify(event.transaction)}`);
    //     const testResultXdr = event.transaction.result_meta_xdr;
    //     logger.info(`🔍 🔴🔴🔴🔴 testResultMetaXdr: ${testResultXdr}`);
    //     logger.info(`🔍 🔴🔴🔴🔴 testResultXdrString: ${testResultXdr.toString()}`);
    // } catch (error) {
    //     logger.error("❌🔴🔴 Error processing Aqua deposit event transaction: ${error}");
    //     throw error;
    // }


    // // 2. Test for error example with getContractData using axios
    // try {
    //     const contractId = "CAQVZKCFWX4HT3C3RUXGR7OETDKRMN433M2QWUXC5X64WE2FKDUFA7GQ";
    //     const ledgerKey = getLedgerKeyContractCode(contractId);
    //     const test = await server.getContractData(new Address(contractId),xdr.ScVal.scvLedgerKeyContractInstance());
    //     logger.info("🔍 test:❌❌❌❌❌");
    //     logger.info(test);
    // } catch (error) {
    //     throw(error);
    // }
    // 3. Test for error example with getContractDataFetch incomplete data
    // try {
    //     const contractId = "CAQVZKCFWX4HT3C3RUXGR7OETDKRMN433M2QWUXC5X64WE2FKDUFA7GQ";
    //     const contractData = await getContractDataFetch(contractId);
    //     logger.info(`🔍 🔴🔴🔴🔴 contractData: ${JSON.stringify(contractData)}`);
    // } catch (error) {
    //     logger.error(`❌ Error processing Aqua deposit event: ${error}`);
    //     throw error;
    // }
    try {
        logger.info(`🔄 Processing AQUA DEPOSIT LIQUIDITY EVENT`);
        
        // Extract data from the event
        const depositData = await extractDepositAquaValues(JSON.parse(JSON.stringify(event)));
        
        // Check if we have the contract address
        if (!depositData.address) {
            logger.error(`❌ No contract address found in deposit event`);
            return;
        }
        
        // Look for the pool in the database
        const existingPool = await AquaPair.get(depositData.address);
        if (!existingPool) {
            logger.info(`⚠️ Pool ${depositData.address} not found in database, creating new record`);
            
            // Create a new record if it doesn't exist
            const newPool = AquaPair.create({
                id: depositData.address,
                ledger: event.ledger.sequence,
                date: new Date(event.ledgerClosedAt),
                address: depositData.address,
                tokenA: depositData.tokenA,
                tokenB: depositData.tokenB,
                poolType: 'unknown', // We could get this from another source
                reserveA: depositData.reserveA || BigInt(0),
                reserveB: depositData.reserveB || BigInt(0)
            });
            
            await newPool.save();
            logger.info(`✅ Created new pool record for ${depositData.address}`);
            return;
        }
        
        // Check if the event is more recent than existing data
        const currentDate = new Date(event.ledgerClosedAt);
        if (new Date(existingPool.date) > currentDate) {
            logger.info(`⏭️ Existing pool data is more recent, NOT updating`);
            return;
        }
        
        // Update the existing record with new data
        if (depositData.reserveA !== undefined) {
            existingPool.reserveA = depositData.reserveA;
        }
        
        if (depositData.reserveB !== undefined) {
            existingPool.reserveB = depositData.reserveB;
        }
        
        existingPool.date = currentDate;
        existingPool.ledger = event.ledger.sequence;
        
        await existingPool.save();
        logger.info(`✨ Updated reserves for pool ${depositData.address}`);
        
    } catch (error) {
        logger.error(`❌ Error processing Aqua deposit event: ${error}`);
        throw error;
    }
}

// AQUA ADD POOL EVENTS AQUA PROTOCOL
export async function aquaAddPoolHandler(event: SorobanEvent): Promise<void> {
    if (!aquaInitialized) {
        await initializeAqua();
        aquaInitialized = true;
    }

    try {
        const eventData = extractAddPoolAquaValues(JSON.parse(JSON.stringify(event)));
        const currentDate = new Date(event.ledgerClosedAt);

        // Check if there is a previous record for this user
        const existingPool = await AquaPair.get(eventData.address);
        
        // If there is a more recent record, do not update
        if (existingPool && new Date(existingPool.date) > currentDate) {
            logger.info(`⏭️ Existing pool data for contract ${eventData.address} is more recent, NOT updating`);
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
            reserveA: BigInt(0), // Initialized in 0
            reserveB: BigInt(0)  // Initialized in 0
        });

        await aquaPair.save();
        logger.info(`✅ Pool event created/updated for address: ${eventData.address}`);

    } catch (error) {
        logger.error(`❌ Error processing Aqua Pool event: ${error}`);
        throw error;
    }
}
