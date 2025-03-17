import { StrKey } from "@stellar/stellar-sdk";
import { Contract } from "@stellar/stellar-sdk";
import { xdr } from "@stellar/stellar-sdk";
import { json } from "stream/consumers";


export function hexToSorobanAddress(hexString: string): string {
  const buffer = Buffer.from(hexString, "hex");
  return StrKey.encodeContract(buffer);
}

export function getTransactionInstanceData(
  event: any,
  contractId: string
): JSON | undefined {
  const resultMetaXdrString = event.transaction.result_meta_xdr;
  const txMeta = xdr.TransactionMeta.fromXDR(resultMetaXdrString, "base64");
  const txOperations = txMeta.v3().operations()[0].changes();

  // Buscar las operaciones que actualizan el contrato específico
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

  logger.info(`filteredOperations: ${filteredOperations.length}`);
  
  // Search in the filtered operations
  for (const operation of filteredOperations) {
    // Verify if it is an update of the contract instance
    const val =
      operation?.["_value"]?._attributes?.data?._value?._attributes?.val;

    if (val?._switch?.name?.includes("ContractInstance")) {
      // find data storage from contract instance
      const storage = val?.instance()?._attributes?.storage;

      return storage;
    }
  }
  
  return undefined;
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

    logger.debug(
      `[AQUA] 🔍 Generated ledger key for ${contractId}: ${xdrBase64}`
    );

    return xdrBase64;
  } catch (error) {
    logger.error(`[AQUA] ❌ Error generating ledger key: ${error}`);
    throw error;
  }
}