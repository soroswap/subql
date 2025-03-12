import { xdr, Address, Contract } from "@stellar/stellar-sdk";
import 'dotenv/config';

//   yarn getLedger: "ts-node scripts/extract-values-events/stellar-sdk/getLedgerEntries.ts"
// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-mainnet.stellar.org';

async function main() {
  const contractId = "CCSNQECGJQ7O6HZJ7IUALVIEMS7F4XUC6XPJVGEEUH2V6SCXG34M4BEI";
  const ledgerKey = getLedgerKeyContractCode(contractId);
  let requestBody = {
    "jsonrpc": "2.0",
    "id": 8675309,
    "method": "getLedgerEntries",
    "params": {
      "keys": [
        ledgerKey
      ]
    }
  }
  function getLedgerKeyContractCode(contractId) {
    const instance = new Contract(contractId).getFootprint();
    return instance.toXDR("base64");
  }

  let res = await fetch(SOROBAN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
  let json = await res.json()
  const fs = require('fs');
  fs.writeFileSync('response.json', JSON.stringify(json, null, 2));
  
  // Check if there are entries in the response
  if (json.result && json.result.entries && json.result.entries.length > 0) {
    // Get the XDR from the first entry
    const xdrData = json.result.entries[0].xdr;
    
    try {
      // Try to decode the XDR
      const decodedData = xdr.LedgerEntryData.fromXDR(xdrData, 'base64');
      const dD = require('fs');
      dD.writeFileSync('decodedData.json', JSON.stringify(decodedData));
      
      // If it's contract data, extract more information
      if (decodedData.switch().name === 'contractData') {
        const contractData = decodedData.contractData();
        
        // Extract ReserveA and ReserveB
        if (contractData.val().switch().name === 'scvContractInstance') {
          const instance = contractData.val().instance();
          if (instance && instance.storage()) {
            const storage = instance.storage();
            
            // Create an object to store the values
            const contractValues = {};
            if(storage){
              // Look for ReserveA and ReserveB in the storage
              for (let i = 0; i < storage.length; i++) {
                const entry = storage[i];
                const key = entry.key();
                
                // Check if the key is a vector containing a symbol
                if (key.switch().name === 'scvVec' && key.vec() && key.vec().length > 0) {
                  const firstElement = key.vec()[0];
                  if (firstElement.switch().name === 'scvSymbol') {
                    // Convert buffer to string for comparison
                    const symbolBuffer = firstElement.sym();
                    const symbolText = Buffer.from(symbolBuffer).toString();
                    
                    // Get the value
                    const val = entry.val();
                    
                    // Store in the values object
                    contractValues[symbolText] = val;
                  }
                }
              }
              
              // Show only ReserveA and ReserveB
              console.log("\nReserve values:");
              console.log("Address:", contractId);
              if (contractValues['ReserveA']) {
                const reserveA = contractValues['ReserveA'];
                if (reserveA.switch().name === 'scvU128') {
                  console.log("ReserveA:", reserveA.u128().lo().toString());
                }
              }
              
              if (contractValues['ReserveB']) {
                const reserveB = contractValues['ReserveB'];
                if (reserveB.switch().name === 'scvU128') {
                  console.log("ReserveB:", reserveB.u128().lo().toString());
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error decoding XDR:", error);
    }
  } else {
    console.log("No entries found in the response or incorrect format.");
  }
}

//Execute main function
main().catch(console.error);

