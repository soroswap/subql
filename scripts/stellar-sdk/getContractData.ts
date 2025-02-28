import { xdr, rpc, scValToNative } from "@stellar/stellar-sdk";
import 'dotenv/config';

// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(SOROBAN_ENDPOINT, { allowHttp: true });


async function main() {
  try {
    const contractId = "CASUGCN324QMLAPWG5IUSXCFD3GZSREDEH54VJCP5MOBOEXDKWSYR2TS";
    
    // For instance type data, we use scvLedgerKeyContractInstance
    const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();
    
    // Get all instance data
    const response = await server.getContractData(contractId, instanceKey);
    
    if (response) {
      // Decode instance data
      const storage = response.val.contractData().val().instance().storage();
      
      // Create an object to store all values
      const contractValues: { [key: string]: any } = {};
      
      // Iterate through storage to get all values
      storage?.forEach((entry) => {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        contractValues[key] = value;
      });

      console.log("Contract Data:");
      console.log(contractValues);
      //console.log(JSON.stringify(contractValues, null, 2));
      
      // If you want to get specific values
      console.log("\nSpecific Values:");
      console.log("ReserveA:", contractValues["ReserveA"]);
      console.log("ReserveB:", contractValues["ReserveB"]);
      console.log("TotalShares:", contractValues["TotalShares"]);
    }

  } catch (error) {
    console.error("XXX Error getting contract data:", error);
    if (error.response?.data) {
      console.error("XXX Error details:", error.response.data);
    }
  }
}

// Execute main function
main().catch(console.error);

