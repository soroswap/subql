import { StrKey } from "@stellar/stellar-sdk";

function hexToSorobanAddress(hexString: string): string {
  const buffer = Buffer.from(hexString, "hex");
  return StrKey.encodeContract(buffer);
}

export const extractValuesNewPair = (
  event: any
): {
  tokenA: string;
  tokenB: string;
  address: string;
} => {
  let tokenA = "";
  let tokenB = "";
  let address = "";

  // Extract the data from the event
  const eventJson = JSON.stringify(event);
  const eventParse = JSON.parse(eventJson);
  const values = eventParse?.value?._value;

  if (!Array.isArray(values)) {
    logger.error("❌🔴🔴 No values array found in NewPair event");
    return {
      tokenA,
      tokenB,
      address,
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

      switch (keyText) {
        case "token_0":
          const tokenABuffer = entry?._attributes?.val?._value?._value?.data;
          if (tokenABuffer) {
            const tokenAHex = Buffer.from(tokenABuffer).toString("hex");
            tokenA = hexToSorobanAddress(tokenAHex);
            //logger.info('→ Token A (hex):', tokenAHex);
            logger.info("→ Token A (Soroban):", tokenA);
          }
          break;
        case "token_1":
          const tokenBBuffer = entry?._attributes?.val?._value?._value?.data;
          if (tokenBBuffer) {
            const tokenBHex = Buffer.from(tokenBBuffer).toString("hex");
            tokenB = hexToSorobanAddress(tokenBHex);
            //logger.info('→ Token B (hex):', tokenBHex);
            logger.info("→ Token B (Soroban):", tokenB);
          }
          break;
        case "pair":
          const pairBuffer = entry?._attributes?.val?._value?._value?.data;
          if (pairBuffer) {
            const pairHex = Buffer.from(pairBuffer).toString("hex");
            address = hexToSorobanAddress(pairHex);
            //logger.info('→ Par (hex):', pairHex);
            logger.info("→ Par (Soroban):", address);
          }
          break;
        default:
          logger.info("⏩🔴🔴 Unrecognized key:", keyText);
      }
    } catch (error) {
      logger.warn("❌🔴🔴 Error processing entry:", error);
    }
  });
  // debug log
  // logger.info('\n🟣🟣🟣🟣 Final result:');
  // logger.info(`Token A: ${tokenA}`);
  // logger.info(`Token B: ${tokenB}`);
  // logger.info(`Pair address: ${address}`);
  // logger.info(`New pairs length: ${newPairsLength}`);

  if (!tokenA || !tokenB || !address) {
    logger.error("❌🔴🔴 Incomplete data in NewPair event");
  }

  return {
    tokenA,
    tokenB,
    address,
  };
};
