import { Sync } from "../types";
import {
  SorobanEvent,
} from "@subql/types-stellar";
import { poolsList } from "./poolsList";
import { config } from 'dotenv';
import { poolReservesList } from "./poolRsvList";
import { NewPair } from "../types";
import { StrKey } from '@stellar/stellar-sdk';

config();

let initialized = false;

// SYNC EVENTS
export async function handleEventSync(event: SorobanEvent): Promise<void> {
    if (!initialized) {
        await initializeSync();
        initialized = true;
    }

  logger.info(
    `New sync event found at block ${event.ledger.sequence.toString()}`
  );
    logger.info("🔵🔵🔵🔵 Entering sync event")
   // Debug log
    
    // let eventJson = JSON.stringify(event);
    // logger.info("🔵🔵")
    // let eventParse = JSON.parse(eventJson);
    // logger.info("eventParse: " + eventParse);
    // logger.info("🔵🔵")
  // Check if contract is in tokens list
  const address = event.contractId?.contractId().toString();
  if (!address || !poolsList.includes(address)) {
    logger.info(`🔴🔴🔴🔴 Error: Contract ${address} is not in allowed tokens list`);
    return;
  }

  try { 
    // Extract reserves first
    const { reserveA, reserveB } = extractReserves(JSON.parse(JSON.stringify(event)));
    
    // Find all existing syncs for this contract
    const existingSyncs = await Sync.get(address);
    // debug log
    logger.info("existingSyncs: " + existingSyncs);
    logger.info("🔵🔵");
    logger.info(existingSyncs);
    logger.info("🔵🔵");
    const currentDate = new Date(event.ledgerClosedAt);
    
    // Create new sync
    const newSync = Sync.create({
      id: address,
      ledger: event.ledger.sequence,
      date: currentDate,
      address: address,
      reserveA: reserveA,
      reserveB: reserveB
    });
    
    // First check if there are older records before saving the new one
    if (existingSyncs) {
          const oldDate = new Date(existingSyncs.date);
          
          if (oldDate < currentDate) {
            logger.info(`🗑️ Deleting old sync from contract ${existingSyncs.id} with date ${oldDate}`);
            await Sync.remove(existingSyncs.id);
          } else {
            logger.info(`⏭️ Existing sync is more recent (${oldDate}), NOT updating`);
            return; // Exit without saving new sync
          }
        }
      
    // If we get here, save the new sync
    await newSync.save();
    logger.info(`✨ Updated sync for contract ${address} with date ${currentDate}`);
    
  } catch (error) {
    logger.error(`❌🔴🔴 Error processing sync event: ${error}`);
    throw error;
  }
}

export async function handleEventNewPair(event: SorobanEvent): Promise<void> {
    logger.info(
        `New NewPair event found at block ${event.ledger.sequence.toString()}`
    );
    // debug log    
    logger.info("🔵🔵🔵🔵");
    logger.info("🔵 Entering NewPair event")
    let eventJson = JSON.stringify(event);
    logger.info(JSON.stringify(event));
    logger.info("🔵🔵")
    //logger.info("eventJson: " + eventJson);
    logger.info("🔵🔵")
    let eventValue = JSON.stringify(event.value);
    logger.info("eventValue: " + eventValue);
    logger.info("🔵🔵🔵🔵")
    let eventParse = JSON.parse(eventJson);
    logger.info(`eventParse: ${eventParse}`);
    logger.info("🔵🔵🔵🔵");

    try {
        const { tokenA, tokenB, address, newPairsLength } = extractValuesNewPair(JSON.parse(JSON.stringify(event)));

        // Create new register
        const newPairEvent = NewPair.create({
            id: event.id,
            ledger: event.ledger.sequence,
            date: new Date(event.ledgerClosedAt),
            tokenA: tokenA,
            tokenB: tokenB,
            address: address,
            newPairsLength: newPairsLength
        });

        await newPairEvent.save();
        logger.info(`✅ New pair saved: ${address} (${tokenA} - ${tokenB})`);

    } catch (error) {
        logger.error(`❌🔴🔴 Error processing NewPair event: ${error}`);
        throw error;
    }
}

//######################### HELPERS #########################

async function initializeSync(): Promise<void> {
  logger.info("🚀 Initializing sync data...");
  const failedPools: string[] = [];
  
  try {
      for (const [index, contractId] of poolsList.entries()) {
          try {
              // Check if there is a sync for this contract
              const existingSync = await Sync.get(contractId);
              if (!existingSync) {
                  logger.info(`📊 Processing pool ${index + 1}/${poolsList.length}: ${contractId}`);
                  
                  // Get current reserves
                  const [reserve0, reserve1] = await getPoolReserves(contractId);
                  
                  if (reserve0 === BigInt(0) && reserve1 === BigInt(0)) {
                      failedPools.push(contractId);
                  }
                  
                  // Create initial sync
                  const newSync = Sync.create({
                      id: contractId,
                      ledger: 55735990 + index,
                      date: new Date(Date.now()),
                      address: contractId,
                      reserveA: reserve0,
                      reserveB: reserve1
                  });
                  
                  await newSync.save();
                  logger.info(`✨ Initial sync created for contract ${contractId}`);
                  
                  // Small pause between each pool
                  await new Promise(resolve => setTimeout(resolve, 1000));
              }
          } catch (error) {
              logger.error(`❌🔴🔴 Error initializing sync for ${contractId}: ${error}`);
              failedPools.push(contractId);
          }
      }
      
      // Final summary
      logger.info("\n📊 Summary of initialization:");
      logger.info(`✅ Pools processed successfully: ${poolsList.length - failedPools.length}`);
      if (failedPools.length > 0) {
          logger.info(`❌🔴🔴 Pools with errors (${failedPools.length}):`);
          failedPools.forEach(pool => logger.info(`   - ${pool}`));
      }
      
  } catch (error) {
      logger.error("❌🔴🔴 General error in initialization:", error);
      throw error;
  }
  
  logger.info("✅ Initialization completed");
}

// Modified function to get reserves from poolRsvList
async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
    try {
        // Search for the pool in the reserves list
        const pool = poolReservesList.find(p => p.contract === contractId);
        
        if (!pool) {
            logger.warn(`⚠️ No reserves found for pool ${contractId} in poolRsvList`);
            return [BigInt(0), BigInt(0)];
        }

        logger.info(`✅ Reserves found for ${contractId}:`);
        logger.info(`Reserve0: ${pool.reserve0}`);
        logger.info(`Reserve1: ${pool.reserve1}`);

        return [BigInt(pool.reserve0), BigInt(pool.reserve1)];
        
    } catch (error) {
        logger.error(`❌🔴🔴 Error getting reserves for ${contractId}: ${error}`);
        logger.warn(`⚠️ Using default values for pool ${contractId}`);
        
        return [BigInt(0), BigInt(0)];
    }
}

interface ReservesResult {
  reserveA: bigint;
  reserveB: bigint;
}
// Extract reserves from a sync event and parse to bigint

function extractReserves(event: any): ReservesResult {
    let reserveA = BigInt(0);
    let reserveB = BigInt(0);

    // Check if we have the correct structure
    const values = event?.value?._value;
    if (!Array.isArray(values)) {
        logger.error('No reserves found');
        return { 
            reserveA, 
            reserveB 
        };
    }

    logger.info("\n🟣🟣🟣🟣 Processing reserves in extractReseves:");
    values.forEach((entry: any) => {
        try {
            logger.info("\n--- Processing entry ---");
            
            // Show full entry
            logger.info("🟣🟣🟣🟣 entry separated:");
            //logger.info(JSON.stringify(entry));

            // Get and show the key as buffer and text
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                //logger.info("❌🔴🔴 No keyBuffer found");
                return;
            }
            const keyText = Buffer.from(keyBuffer).toString();
            //logger.info('Key (Buffer):'+ JSON.stringify(entry._attributes.key));
            //logger.info('Key (Text):' + keyText);

            // Get and show the full value and its details
            const value = entry?._attributes?.val?._value?._attributes?.lo?._value;
            //logger.info('Val lo details:'+ JSON.stringify(entry._attributes.val._value._attributes.lo));
            
            if (!value) {
                logger.info("❌🔴🔴 No value found");
                return;
            }

            logger.info('✅ Final value found:' + value);

            // Assign the value according to the key
            if (keyText === 'new_reserve_0') {
                reserveA = BigInt(value);
                logger.info('→ Updated reserveA:' + reserveA.toString());
            } else if (keyText === 'new_reserve_1') {
                reserveB = BigInt(value);
                logger.info('→ Updated reserveB:' + reserveB.toString());
            }
        } catch (error) {
            logger.warn('❌🔴🔴 Error processing entry:', error);
        }
    });
    // debug log
    logger.info('\n🟣🟣🟣🟣 Final result:');
    logger.info(`reserveA: ${reserveA.toString()}`);
    logger.info(`reserveB: ${reserveB.toString()}`);

    return {
        reserveA,
        reserveB
    };
}

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

function extractValuesNewPair(event: any): { tokenA: string, tokenB: string, address: string, newPairsLength: number } {
    let tokenA = '';
    let tokenB = '';
    let address = '';
    let newPairsLength = 0;

    // Extract the data from the event
    const eventJson = JSON.stringify(event);
    const eventParse = JSON.parse(eventJson);
    const values = eventParse?.value?._value;

    if (!Array.isArray(values)) {
        logger.error('❌🔴🔴 No values array found in NewPair event');
        return {
            tokenA,
            tokenB,
            address,
            newPairsLength
        };
    }

    logger.info("\n🟣🟣🟣🟣 Processing NewPair event:");

    values.forEach((entry: any) => {
        try {
            const keyBuffer = entry?._attributes?.key?._value?.data;
            if (!keyBuffer) {
                logger.info("❌🔴🔴 No keyBuffer found");
                return;
            }

            const keyText = Buffer.from(keyBuffer).toString();
            //logger.info('Key (Text):', keyText);

            switch(keyText) {
                case 'token_0':
                    const tokenABuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenABuffer) {
                        const tokenAHex = Buffer.from(tokenABuffer).toString('hex');
                        tokenA = hexToSorobanAddress(tokenAHex);
                        //logger.info('→ Token A (hex):', tokenAHex);
                        logger.info('→ Token A (Soroban):', tokenA);
                    }
                    break;
                case 'token_1':
                    const tokenBBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (tokenBBuffer) {
                        const tokenBHex = Buffer.from(tokenBBuffer).toString('hex');
                        tokenB = hexToSorobanAddress(tokenBHex);
                        //logger.info('→ Token B (hex):', tokenBHex);
                        logger.info('→ Token B (Soroban):', tokenB);
                    }
                    break;
                case 'pair':
                    const pairBuffer = entry?._attributes?.val?._value?._value?.data;
                    if (pairBuffer) {
                        const pairHex = Buffer.from(pairBuffer).toString('hex');
                        address = hexToSorobanAddress(pairHex);
                        //logger.info('→ Par (hex):', pairHex);
                        logger.info('→ Par (Soroban):', address);
                    }
                    break;
                case 'new_pairs_length':
                    newPairsLength = parseInt(entry?._attributes?.val?._value || '0');
                    logger.info('→ New pairs length updated:', newPairsLength);
                    break;
                default:
                    logger.info('⏩🔴🔴 Unrecognized key:', keyText);
            }
        } catch (error) {
            logger.warn('❌🔴🔴 Error processing entry:', error);
        }
    });
    // debug log
    // logger.info('\n🟣🟣🟣🟣 Final result:');
    // logger.info(`Token A: ${tokenA}`);
    // logger.info(`Token B: ${tokenB}`);
    // logger.info(`Pair address: ${address}`);
    // logger.info(`New pairs length: ${newPairsLength}`);

    if (!tokenA || !tokenB || !address || !newPairsLength) {
        logger.error('❌🔴🔴 Incomplete data in NewPair event');
    }

    return {
        tokenA,
        tokenB,
        address,
        newPairsLength
    };
}
// async function checkAndGetAccount(
//   id: string,
//   ledgerSequence: number
// ): Promise<Account> {
//   let account = await Account.get(id.toLowerCase());
//   if (!account) {
//     // We couldn't find the account
//     account = Account.create({
//       id: id.toLowerCase(),
//       firstSeenLedger: ledgerSequence,
//     });
//   }
//   return account;
// }

// scValToNative not works, temp solution
// function decodeAddress(scVal: xdr.ScVal): string {
//   try {
//     return Address.account(scVal.address().accountId().ed25519()).toString();
//   } catch (e) {
//     return Address.contract(scVal.address().contractId()).toString();
//   }
// }
