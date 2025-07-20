import { hexToSorobanAddress } from "../../utils";

// Helper function to extract values from the add_pool event
export function extractAddPoolAquaValues(event: any): {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  poolType: string;
  idx: string;
} {
  let result = {
    address: "",
    tokenA: "",
    tokenB: "",
    tokenC: "",
    poolType: "",
    idx: "",
  };

  try {
    // Extract user from value
    const values = event?.value?._value;
    if (!Array.isArray(values)) {
      throw new Error("[AQUA] No values array found in AddPool event");
    }

    logger.debug("\n[AQUA] 🔄 Processing Aqua AddPool event values:");

    // User address (first value of value)
    const userBuffer = values[0]?._value?._value?.data;
    if (userBuffer) {
      result.address = hexToSorobanAddress(
        Buffer.from(userBuffer).toString("hex")
      );
      logger.debug(`→ User address: ${result.address}`);
    }
    
    // pool type
    const poolType = values[1]?._value?.data;
    if (poolType) {
      result.poolType = Buffer.from(poolType).toString("utf8");
      logger.debug(`→ Pool type: ${result.poolType}`);
    }
    
    // subpool_salt (idx) 
    const subpoolSalt = values[2]?._value?.data;
    if (subpoolSalt) {
      result.idx = Buffer.from(subpoolSalt).toString('base64');
      logger.debug(`→ Subpool salt (idx): ${result.idx}`);
    }

    // Tokens del topic[1]
    const topicTokens = event?.topic?.[1]?._value;
    if (Array.isArray(topicTokens)) {
      // Token A
      if (topicTokens.length >= 1) {
        const tokenABuffer = topicTokens[0]?._value?._value?.data;
        if (tokenABuffer) {
          result.tokenA = hexToSorobanAddress(
            Buffer.from(tokenABuffer).toString("hex")
          );
          logger.debug(`→ Token A: ${result.tokenA}`);
        }
      }

      // Token B
      if (topicTokens.length >= 2) {
        const tokenBBuffer = topicTokens[1]?._value?._value?.data;
        if (tokenBBuffer) {
          result.tokenB = hexToSorobanAddress(
            Buffer.from(tokenBBuffer).toString("hex")
          );
          logger.debug(`→ Token B: ${result.tokenB}`);
        }
      }
      
      // Token C (solo para pools estables)
      if (topicTokens.length >= 3 && result.poolType === "stable") {
        const tokenCBuffer = topicTokens[2]?._value?._value?.data;
        if (tokenCBuffer) {
          result.tokenC = hexToSorobanAddress(
            Buffer.from(tokenCBuffer).toString("hex")
          );
          logger.debug(`→ Token C: ${result.tokenC}`);
        }
      }
    }

    if (!result.address || !result.tokenA || !result.tokenB) {
      throw new Error("[AQUA] Incomplete data in AddPool event");
    }

    return result;
  } catch (error) {
    logger.error(`[AQUA] ❌ Error extracting AddPool values: ${error}`);
    throw error;
  }
}
