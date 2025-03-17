import { getTransactionInstanceData, hexToSorobanAddress } from "../../utils";
import { getTransactionData, getAquaData } from "./utils";

// Helper function to extract values from deposit event
export async function extractAquaValues(event: any): Promise<{
  address: string;
  tokenA: string;
  tokenB: string;
  reserveA?: bigint;
  reserveB?: bigint;
  fee?: bigint;
}> {
  let result = {
    address: "",
    tokenA: "",
    tokenB: "",
    reserveA: undefined as bigint | undefined,
    reserveB: undefined as bigint | undefined,
    fee: undefined as bigint | undefined,
  };

  try {
    logger.info(`txHash: ${event.txHash.toString()}`);
    // User address (first value of the value)
    result.address = event.contractId.toString();

    // Get contract data using getLedgerEntries
    if (result.address) {
      logger.debug(`🔍 Fetching contract data for ${result.address}...`);
      // let contractData = await getContractDataFetch(result.address);
      let contractDataInstance = getTransactionInstanceData(event, result.address);
      let contractData = getAquaData(contractDataInstance, result.address);
      logger.info(`🔍 XXXXXXXXXXXXXXx Contract data TEST: ${contractData}`);
      // let contractData = getTransactionData(event, result.address);
      // logger.info(`🔍 XXXXXXXXXXXXXXx Contract data: ${contractData}`);

      if (contractData.tokenA !== undefined) {
        result.tokenA = contractData.tokenA;
        logger.debug(
          `[AQUA] → TokenA from contract: ${result.tokenA.toString()}`
        );
      }

      if (contractData.tokenB !== undefined) {
        result.tokenB = contractData.tokenB;
        logger.debug(
          `[AQUA] → TokenB from contract: ${result.tokenB.toString()}`
        );
      }

      if (contractData.reserveA !== undefined) {
        result.reserveA = contractData.reserveA;
        logger.debug(
          `[AQUA] → ReserveA from contract: ${result.reserveA.toString()}`
        );
      }

      if (contractData.reserveB !== undefined) {
        result.reserveB = contractData.reserveB;
        logger.debug(
          `[AQUA] → ReserveB from contract: ${result.reserveB.toString()}`
        );
      }

      if (contractData.fee !== undefined) {
        result.fee = contractData.fee;
        logger.debug(`[AQUA] → Fee from contract: ${result.fee.toString()}`);
      }

      // If no data is found, use default values
      if (result.reserveA === undefined && result.reserveB === undefined) {
        logger.info(
          `⚠️ No reserve data found for contract ${result.address}, using default values`
        );
        result.reserveA = BigInt(0);
        result.reserveB = BigInt(0);
      }
    }

    return result;
  } catch (error) {
    logger.error(`❌ Error extracting Aqua values: ${error}`);
    return result;
  }
}
