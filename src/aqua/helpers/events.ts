import { hexToSorobanAddress } from "../../utils";
import { getTransactionData } from "./utils";

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
    // User address (first value of the value)
    const contractId = event?.contractId.toString();
    if (contractId) {
      result.address = hexToSorobanAddress(
        Buffer.from(contractId).toString("hex")
      );
      logger.debug(`→ Contract address: ${result.address}`);
    }
    // Token A
    const topicTokens1 = event?.topic?.[1]?._value;
    const tokenABuffer = topicTokens1?._value?.data;
    if (tokenABuffer) {
      result.tokenA = hexToSorobanAddress(
        Buffer.from(tokenABuffer).toString("hex")
      );
      logger.debug(`→ Token A: ${result.tokenA}`);
    }
    // Token B
    const topicTokens2 = event?.topic?.[2]?._value;
    const tokenBBuffer = topicTokens2?._value?.data;
    if (tokenBBuffer) {
      result.tokenB = hexToSorobanAddress(
        Buffer.from(tokenBBuffer).toString("hex")
      );
      logger.debug(`→ Token B: ${result.tokenB}`);
    }

    if (!result.address || !result.tokenA || !result.tokenB) {
      throw new Error("Incomplete data in event");
    }

    // Get contract data using getLedgerEntries
    if (result.address) {
      logger.debug(`🔍 Fetching contract data for ${result.address}...`);
      // let contractData = await getContractDataFetch(result.address);
      let contractData = getTransactionData(event, result.address);

      if (contractData.reserveA !== undefined) {
        result.reserveA = contractData.reserveA;
        logger.debug(`→ ReserveA from contract: ${result.reserveA.toString()}`);
      }

      if (contractData.reserveB !== undefined) {
        result.reserveB = contractData.reserveB;
        logger.debug(`→ ReserveB from contract: ${result.reserveB.toString()}`);
      }

      if (contractData.fee !== undefined) {
        result.fee = contractData.fee;
        logger.debug(`→ Fee from contract: ${result.fee.toString()}`);
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
