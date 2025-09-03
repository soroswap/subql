import { StrKey } from "@stellar/stellar-sdk";
import { getTransactionData } from "./utils";

// Helper function to extract values from deposit event
export async function extractAquaValues(event: any): Promise<{
  address: string;
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  reserveA: bigint;
  reserveB: bigint;
  reserveC?: bigint;
  fee?: bigint;
  futureA?: bigint;
  futureATime?: bigint;
  initialA?: bigint;
  initialATime?: bigint;
  precisionMulA?: bigint;
  precisionMulB?: bigint;
  precisionMulC?: bigint;
}> {
  let result = {
    address: "",
    tokenA: "",
    tokenB: "",
    tokenC: undefined as string | undefined,
    reserveA: undefined as bigint | undefined,
    reserveB: undefined as bigint | undefined,
    reserveC: undefined as bigint | undefined,
    fee: undefined as bigint | undefined,
    futureA: undefined as bigint | undefined,
    futureATime: undefined as bigint | undefined,
    initialA: undefined as bigint | undefined,
    initialATime: undefined as bigint | undefined,
    precisionMulA: undefined as bigint | undefined,
    precisionMulB: undefined as bigint | undefined,
    precisionMulC: undefined as bigint | undefined,
  };

  try {
    
    logger.info(`txHash: ${event.txHash.toString()}`);
    // User address (first value of the value)
    result.address = event.contractId.toString();

    // Get contract data using getLedgerEntries
    if (result.address) {
      logger.info(`🔍 Fetching contract data for ${result.address}...`);
      // let contractData = await getContractDataFetch(result.address);
      let contractData = getTransactionData(event, result.address);

      if (contractData.tokenA !== undefined) {
        result.tokenA = contractData.tokenA;
        logger.info(`[AQUA] → TokenA from contract: ${result.tokenA.toString()}`);
      }

      if (contractData.tokenB !== undefined) {
        result.tokenB = contractData.tokenB;
        logger.info(`[AQUA] → TokenB from contract: ${result.tokenB.toString()}`);
      }

      if (contractData.reserveA !== undefined) {
        result.reserveA = contractData.reserveA;
        logger.info(`[AQUA] → ReserveA from contract: ${result.reserveA.toString()}`);
      }

      if (contractData.reserveB !== undefined) {
        result.reserveB = contractData.reserveB;
        logger.info(`[AQUA] → ReserveB from contract: ${result.reserveB.toString()}`);
      }

      if (contractData.fee !== undefined) {
        result.fee = contractData.fee;
        logger.info(`[AQUA] → Fee from contract: ${result.fee.toString()}`);
      }

      // Assign values for stable pools
      if (contractData.tokenC !== undefined) {
        result.tokenC = contractData.tokenC;
        logger.info(`[AQUA] → TokenC from contract: ${result.tokenC}`);
      }

      if (contractData.reserveC !== undefined) {
        result.reserveC = contractData.reserveC;
        logger.info(`[AQUA] → ReserveC from contract: ${result.reserveC.toString()}`);
      }

      if (contractData.futureA !== undefined) {
        result.futureA = contractData.futureA;
        logger.info(`[AQUA] → FutureA from contract: ${result.futureA.toString()}`);
      }

      if (contractData.futureATime !== undefined) {
        result.futureATime = contractData.futureATime;
        logger.info(`[AQUA] → FutureATime from contract: ${result.futureATime.toString()}`);
      }

      if (contractData.initialA !== undefined) {
        result.initialA = contractData.initialA;
        logger.info(`[AQUA] → InitialA from contract: ${result.initialA.toString()}`);
      }

      if (contractData.initialATime !== undefined) {
        result.initialATime = contractData.initialATime;
        logger.info(`[AQUA] → InitialATime from contract: ${result.initialATime.toString()}`);
      }

      if (contractData.precisionMulA !== undefined) {
        result.precisionMulA = contractData.precisionMulA;
        logger.info(`[AQUA] → PrecisionMulA from contract: ${result.precisionMulA.toString()}`);
      }

      if (contractData.precisionMulB !== undefined) {
        result.precisionMulB = contractData.precisionMulB;
        logger.info(`[AQUA] → PrecisionMulB from contract: ${result.precisionMulB.toString()}`);
      }

      if (contractData.precisionMulC !== undefined) {
        result.precisionMulC = contractData.precisionMulC;
        logger.info(`[AQUA] → PrecisionMulC from contract: ${result.precisionMulC.toString()}`);
      }

      // If no data is found, use default values
      if (result.reserveA === undefined && result.reserveB === undefined) {
        logger.info(`⚠️ No reserve data found for contract ${result.address}, using default values`);
        result.reserveA = BigInt(0);
        result.reserveB = BigInt(0);
      }
    }

    return result;
  } catch (error) {
    logger.error(`[AQUA] ❌ Error extracting Aqua values: ${error}`);
    return result;
  }
}

export async function getFactoryTopic(event: any): Promise<string> {
  let factoryAddress = "";

  if (event.topic[3]) {
    if (event.topic[3].address().switch().name === "scAddressTypeContract") {
      try {
        const contractIdBuffer = event.topic[3].address().contractId();
        factoryAddress = StrKey.encodeContract(contractIdBuffer);
      } catch (error) {
        logger.error(`Error getting factory address: ${error}`);
      }
    }
  }
  return factoryAddress;
}
