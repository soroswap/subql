import * as fs from 'fs';
import * as path from 'path';
import { StrKey, xdr, Contract } from '@stellar/stellar-sdk';
import 'dotenv/config';

// yarn test:deposit: "ts-node scripts/tests/event_deposit_aqua.ts"

interface AddPoolResult {
    address: string;
    tokenA: string;
    tokenB: string;
    reserveA?: bigint;
    reserveB?: bigint;
}

// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

// Function to get ledger key for contract instance
function getLedgerKeyContractCode(contractId) {
    const instance = new Contract(contractId).getFootprint();
    return instance.toXDR("base64");
  }

// function getLedgerKeyContractCode(contractId: string): string {
//     const ledgerKey = xdr.LedgerKey.contractData(
//         new xdr.LedgerKeyContractData({
//             contract: new Address(contractId).toScAddress(),
//             key: xdr.ScVal.scvLedgerKeyContractInstance(),
//             durability: xdr.ContractDataDurability.persistent(),
//         }),
//     );
//     return ledgerKey.toXDR("base64");
// }

// Function to get contract data using getLedgerEntries
async function getContractData(contractId: string): Promise<{reserveA?: bigint, reserveB?: bigint}> {
    try {
        console.log(`🔍 Getting contract data for: ${contractId}`);
        
        const ledgerKey = getLedgerKeyContractCode(contractId);
        const requestBody = {
            "jsonrpc": "2.0",
            "id": 8675309,
            "method": "getLedgerEntries",
            "params": {
                "keys": [
                    ledgerKey
                ]
            }
        };
        
        const res = await fetch(SOROBAN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        
        const json = await res.json();
        
        // Check if there are entries in the response
        if (json.result && json.result.entries && json.result.entries.length > 0) {
            // Get the XDR from the first entry
            const xdrData = json.result.entries[0].xdr;
            
            try {
                // Try to decode the XDR
                const decodedData = xdr.LedgerEntryData.fromXDR(xdrData, 'base64');
                
                // If it's contract data, extract more information
                if (decodedData.switch().name === 'contractData') {
                    const contractData = decodedData.contractData();
                    
                    // Extract ReserveA and ReserveB
                    if (contractData.val().switch().name === 'scvContractInstance') {
                        const instance = contractData.val().instance();
                        if (instance && instance.storage()) {
                            const storage = instance.storage();
                            
                            // Create an object to store the values
                            const contractValues: { [key: string]: any } = {};
                            
                            if(storage) {
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
                                
                                // search reserves - they can have different names depending on the contract
                                let reserveA: bigint | undefined;
                                let reserveB: bigint | undefined;
                                
                                // possible names for reserves
                                const reserveANames = ["ReserveA", "reserve_a", "reserve0", "Reserve0"];
                                const reserveBNames = ["ReserveB", "reserve_b", "reserve1", "Reserve1"];
                                
                                // search reserveA
                                for (const name of reserveANames) {
                                    if (contractValues[name] !== undefined) {
                                        const reserveAVal = contractValues[name];
                                        if (reserveAVal.switch().name === 'scvU128') {
                                            reserveA = BigInt(reserveAVal.u128().lo().toString());
                                            console.log(`→ ReserveA (${name}): ${reserveA.toString()}`);
                                            break;
                                        }
                                    }
                                }
                                
                                // search reserveB
                                for (const name of reserveBNames) {
                                    if (contractValues[name] !== undefined) {
                                        const reserveBVal = contractValues[name];
                                        if (reserveBVal.switch().name === 'scvU128') {
                                            reserveB = BigInt(reserveBVal.u128().lo().toString());
                                            console.log(`→ ReserveB (${name}): ${reserveB.toString()}`);
                                            break;
                                        }
                                    }
                                }
                                
                                // if we don't find the reserves, show all available keys
                                if (reserveA === undefined || reserveB === undefined) {
                                    console.log("⚠️ Not all reserves found. Available keys:");
                                    Object.keys(contractValues).forEach(key => {
                                        console.log(`- ${key}`);
                                    });
                                }
                                
                                return {
                                    reserveA,
                                    reserveB
                                };
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("❌ Error decoding XDR:", error);
            }
        } else {
            console.log("No entries found in the response or incorrect format.");
        }
        
        return {};
    } catch (error) {
        console.error("❌ Error getting contract data:", error);
        if (error.response?.data) {
            console.error("❌ Error details:", error.response.data);
        }
        return {};
    }
}

// helper function to extract values from deposit event
async function extractDepositAquaValues(event: any): Promise<AddPoolResult> {
    let result: AddPoolResult = {
        address: '',
        tokenA: '',
        tokenB: '',
        reserveA: undefined,
        reserveB: undefined
    };

    try {
        console.log("\n🔄 Processing Aqua Deposit event values:");

        // User address (first value of the value)
        const contractBuffer = event?.contractId?._id?.data;
        if (contractBuffer) {
            result.address = hexToSorobanAddress(Buffer.from(contractBuffer).toString('hex'));
            console.log(`→ Contract address: ${result.address}`);
        }
        // Token A
        const topicTokens1 = event?.topic?.[1]?._value;
        const tokenABuffer = topicTokens1?._value?.data;
        if (tokenABuffer) {
            result.tokenA = hexToSorobanAddress(Buffer.from(tokenABuffer).toString('hex'));
            console.log(`→ Token A: ${result.tokenA}`);
        }
        // Token B
        const topicTokens2 = event?.topic?.[2]?._value;
        const tokenBBuffer = topicTokens2?._value?.data;
        if (tokenBBuffer) {
            result.tokenB = hexToSorobanAddress(Buffer.from(tokenBBuffer).toString('hex'));
            console.log(`→ Token B: ${result.tokenB}`);
        }
        
        if (!result.address || !result.tokenA || !result.tokenB) {
            throw new Error('Incomplete data in Deposit event');
        }

        // get contract data
        if (result.address) {
            console.log(`🔍 Fetching contract data for ${result.address}...`);
            const contractData = await getContractData(result.address);
            
            if (contractData.reserveA !== undefined) {
                result.reserveA = contractData.reserveA;
                console.log(`→ ReserveA from contract: ${result.reserveA.toString()}`);
            }
            
            if (contractData.reserveB !== undefined) {
                result.reserveB = contractData.reserveB;
                console.log(`→ ReserveB from contract: ${result.reserveB.toString()}`);
            }
        }

        return result;
    } catch (error) {
        console.error(`❌ Error extracting Aqua Deposit values: ${error}`);
        throw error;
    }
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event_deposit_aqua.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error reading event_deposit_aqua.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function runTest() {
    try {
        console.log('=== Running Aqua Deposit Test ===');
        const eventData = loadEventData();
        
        console.log("🔴 Event data loaded");

        if (eventData) {
            console.log('✅ Event structure found');
            const depositData = await extractDepositAquaValues(eventData);
            
            console.log('=== Extracted deposit data ===');
        } else {
            console.error('❌ Expected event structure not found');
        }
    } catch (error) {
        console.error('Test error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
        }
    }
}

// Run the test
runTest().catch(console.error);
