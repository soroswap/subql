import { Contract, StrKey } from "@stellar/stellar-sdk";
import { xdr } from '@stellar/stellar-sdk';
import { encodeContract } from "../../soroswap/helpers/utils";

export function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}
export function getTransactionData(event: any, contractId: string): {
  tokenA: string | undefined;
  tokenB: string | undefined;
  reserveA: bigint | undefined;
  reserveB: bigint | undefined;
} {
  let reserveA: bigint | undefined;
  let reserveB: bigint | undefined;
  let tokenA: string | undefined;
  let tokenB: string | undefined;
  let tokens = [];
  let reserves = [];
      
  const resultMetaXdrString = event.transaction.result_meta_xdr;

  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
  logger.info(`--------------------------------------------------------`);

  const txOperations = txMeta.v3().operations()[0].changes();
  logger.info(`[COMET] 🟢 Operations Length: ${txOperations.length}`);

  const filteredOperations = txOperations.filter((operation) => {
    const switchName = operation?.["_switch"]?.name;    
    const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
      ?.contract?._value;
    
    if (switchName === "ledgerEntryUpdated" && contractBuffer) {
      const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
      const contract = encodeContract(
        Buffer.from(contractData).toString("hex")            
      );
      return contract === contractId;
    }
    return false;
  });
  
  logger.info(`[COMET] 🔍 Operations filtered: ${filteredOperations.length}`);

  // Convert to JSON for easier processing
  logger.info(`[COMET] 🔍 Converting operations to JSON`);
  const operationsJson = JSON.parse(JSON.stringify(filteredOperations));
  
  // Search for the operation that contains AllRecordData
  logger.info(`[COMET] 🔍 Searching for AllRecordData in ${operationsJson.length} operations`);
  for (const operation of operationsJson) {
    try {      
      if (operation._switch && operation._switch.name === "ledgerEntryUpdated") {
        const data = operation._value?._attributes?.data?._value?._attributes;
        
        // Filter only operations with the expected structure
        if (!data || !data.val || !data.val._value || !Array.isArray(data.val._value)) {
          continue;
        }
        // Process only operations with the correct structure
        for (const item of data.val._value) {
          let tokenBuffer = item?._attributes?.key?._value?._value?.data;
          if (tokenBuffer) {  
            tokens.push(hexToSorobanAddress(Buffer.from(tokenBuffer).toString('hex')));
            reserves.push(item._attributes.val._value[0]._attributes.val._value._attributes.lo._value);
          }
        }
        if (tokens.length >= 2) {
          tokenA = tokens[0];
          tokenB = tokens[1];
          reserveA = BigInt(reserves[0]);
          reserveB = BigInt(reserves[1]);
        }
      }
    } catch (err) {
      logger.error(`[COMET] ❌ Error details: ${err.stack}`);
    }
  }
  logger.info(
    `[COMET] 🟢 Tokens: TokenA=${tokenA || "not found"}, TokenB=${tokenB || "not found"}`
  );
  logger.info(
    `[COMET] 🟢 Reserves: ReserveA=${reserveA?.toString() || "not found"}, ReserveB=${reserveB?.toString() || "not found"}`
  );

  return {
    tokenA,
    tokenB,
    reserveA,
    reserveB
  };
}
// Function to get ledger key for contract instance
export function getLedgerKeyContractCode(contractId: string): string {
    try {
        // Create contract instance and get its footprint
        const contract = new Contract(contractId);
        
        // Get contract footprint (footprint)
        const footprint = contract.getFootprint();
        
        // Convert to XDR in base64 format
        const xdrBase64 = footprint.toXDR("base64");
        
        logger.debug(`[COMET] 🔍 Generated ledger key for ${contractId}: ${xdrBase64}`);
        
        return xdrBase64;
    } catch (error) {
        logger.error(`[COMET] ❌ Error generating ledger key: ${error}`);
        throw error;
    }
}