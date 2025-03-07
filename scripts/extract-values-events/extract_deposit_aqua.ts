import * as fs from 'fs';
import * as path from 'path';
import { StrKey, xdr, rpc, scValToNative } from '@stellar/stellar-sdk';
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
const server = new rpc.Server(SOROBAN_ENDPOINT, { allowHttp: true });

function hexToSorobanAddress(hexString: string): string {
    const buffer = Buffer.from(hexString, 'hex');
    return StrKey.encodeContract(buffer);
}

// function to get contract data
async function getContractData(contractId: string): Promise<{reserveA?: bigint, reserveB?: bigint}> {
    try {
        console.log(`🔍 Getting contract data for: ${contractId}`);
        
        
        // For instance type data, we use scvLedgerKeyContractInstance
        const instanceKey = xdr.ScVal.scvLedgerKeyContractInstance();
        
        // Get all instance data
        const response = await server.getContractData(contractId, instanceKey);
        
        if (!response) {
            console.log("❌ No contract data found");
            return {};
        }
        
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

        console.log("📊 Contract Data Summary:");
        
        // search reserves - they can have different names depending on the contract
        let reserveA: bigint | undefined;
        let reserveB: bigint | undefined;
        
        // possible names for reserves
        const reserveANames = ["ReserveA", "reserve_a", "reserve0", "Reserve0"];
        const reserveBNames = ["ReserveB", "reserve_b", "reserve1", "Reserve1"];
        
        // search reserveA
        for (const name of reserveANames) {
            if (contractValues[name] !== undefined) {
                reserveA = BigInt(contractValues[name]);
                console.log(`→ ReserveA (${name}): ${reserveA.toString()}`);
                break;
            }
        }
        
        // search reserveB
        for (const name of reserveBNames) {
            if (contractValues[name] !== undefined) {
                reserveB = BigInt(contractValues[name]);
                console.log(`→ ReserveB (${name}): ${reserveB.toString()}`);
                break;
            }
        }
        
        // if we don't find the reserves, show all available keys
        if (reserveA === undefined || reserveB === undefined) {
            console.log("⚠️ Not all reserves found. Available keys:");
            Object.keys(contractValues).forEach(key => {
                console.log(`- ${key}: ${contractValues[key]}`);
            });
        }
        
        return {
            reserveA,
            reserveB
        };

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
        //console.error('Event data was:', JSON.stringify(event, null, 2));
        throw error;
    }
}

function loadEventData(): any {
    try {
        const eventFilePath = path.join(__dirname, 'event_deposit_aqua.json');
        const rawData = fs.readFileSync(eventFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error(`Error al leer event_deposit_aqua.json: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
}

async function runTest() {
    try {
        console.log('=== Ejecutando prueba de Deposit Aqua ===');
        const eventData = loadEventData();
        
        console.log("🔴 Datos del evento cargados");
        //console.log(JSON.stringify(eventData, null, 2));

        if (eventData) {
            console.log('✅ Estructura del evento encontrada');
            const depositData = await extractDepositAquaValues(eventData);
            
            console.log('=== Datos del deposit extraídos ===');
            console.log(JSON.stringify(depositData, null, 2));
        } else {
            console.error('❌ No se encontró la estructura esperada en el evento');
        }
    } catch (error) {
        console.error('Error en la prueba:', error);
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
        }
    }
}

// Ejecutar la prueba
runTest().catch(console.error);
