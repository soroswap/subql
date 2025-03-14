import { hexToSorobanAddress, getTransactionData} from './utils';
import { CometPair } from '../../types/models/CometPair';

// Helper function to extract values from deposit event
export function extractValuesCometEvent(event: any): {
    address: string;
    tokenA: string;
    tokenB: string;
    reserveA?: bigint;
    reserveB?: bigint;
} {
    let result = {
        address: '',
        tokenA: '',
        tokenB: '',
        reserveA: undefined as bigint | undefined,
        reserveB: undefined as bigint | undefined,

    };
    logger.info(`[COMET] 🔍 contractID: ${event.contractId.toString()}`);

    try { 
        // User address (first value of the value)
        const contractId = event?.contractId?.toString();
        if (contractId) {
            result.address = contractId;
            logger.info(`→ Contract address: ${result.address}`);
        }
        
        // Get contract data using transaction data
        if (result.address) {
            logger.info(`🔍 Fetching contract data for ${result.address}...`);
            // Importante: esta función ya no es async, así que no necesitamos await
            const contractData = getTransactionData(event, result.address); 
            
            if (contractData.tokenA !== undefined) {
                result.tokenA = contractData.tokenA;
                logger.info(`→ TokenA from contract: ${result.tokenA}`);
            }
            
            if (contractData.tokenB !== undefined) {
                result.tokenB = contractData.tokenB;
                logger.info(`→ TokenB from contract: ${result.tokenB}`);
            }
            
            if (contractData.reserveA !== undefined) {
                result.reserveA = contractData.reserveA;
                logger.info(`→ ReserveA from contract: ${result.reserveA.toString()}`);
            }
            
            if (contractData.reserveB !== undefined) {
                result.reserveB = contractData.reserveB;
                logger.info(`→ ReserveB from contract: ${result.reserveB.toString()}`);
            }

            if (result.reserveA === undefined && result.reserveB === undefined) {
                logger.info(`⚠️ No reserve data found for contract ${result.address}, using default values`);
                result.reserveA = BigInt(0);
                result.reserveB = BigInt(0);
            }
        }
        return result;
    } 
    catch (error) {
        logger.error(`❌ Error extracting Comet values: ${error}`);
        return result;
    }
} 

export const updatePairReserves = async (
    contractId: string,
    currentDate: Date,
    sequence: number,
    tokenA: string,
    tokenB: string,
    reserveA?: bigint,
    reserveB?: bigint,
  ) => {
    const existingPair = await CometPair.get(contractId);
    
    if (!existingPair) {
        logger.info(`[COMET] 🆕 Creating new pair record for ${contractId}`);
        const newPair = CometPair.create({
            id: contractId,
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: reserveA || BigInt(0),
            reserveB: reserveB || BigInt(0),
            date: currentDate,
            ledger: sequence
        });
        await newPair.save();
        return;
    }
    
    if (existingPair && new Date(existingPair.date) > currentDate) {
      logger.info(`[COMET] ⏭️ Existing pair data is more recent, NOT updating`);
      return;
    }
  
    existingPair.reserveA = reserveA ?? existingPair.reserveA;
    existingPair.reserveB = reserveB ?? existingPair.reserveB;
    existingPair.date = currentDate;
    existingPair.ledger = sequence;
  
    await existingPair.save();
  };
  