import { Contract, StrKey } from "@stellar/stellar-sdk";
import { xdr } from '@stellar/stellar-sdk';
import { hexToSorobanAddress } from "../../utils";


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
  logger.debug(`--------------------------------------------------------`);

  const txOperations = txMeta.v3().operations()[0].changes();
  logger.debug(`[COMET] 🟢 Operations Length: ${txOperations.length}`);

  const filteredOperations = txOperations.filter((operation) => {
    const switchName = operation?.["_switch"]?.name;    
    const contractBuffer = operation?.value()?.data()?.["_value"]?._attributes
      ?.contract?._value;
    
    if (switchName === "ledgerEntryUpdated" && contractBuffer) {
      const contractData = JSON.parse(JSON.stringify(contractBuffer)).data;
      const contract = hexToSorobanAddress(
        Buffer.from(contractData).toString("hex")            
      );
      return contract === contractId;
    }
    return false;
  });
  
  logger.debug(`[COMET] 🔍 Operations filtered: ${filteredOperations.length}`);

  // Convert to JSON for easier processing
  const operationsJson = JSON.parse(JSON.stringify(filteredOperations));
  
  // Search for the operation that contains AllRecordData
  logger.debug(`[COMET] 🔍 Searching for AllRecordData in ${operationsJson.length} operations`);
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
  logger.debug(
    `[COMET] 🟢 Tokens: TokenA=${tokenA || "not found"}, TokenB=${tokenB || "not found"}`
  );
  logger.debug(
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