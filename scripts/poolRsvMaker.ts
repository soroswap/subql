import { config } from 'dotenv';
import { invokeCustomContract, createToolkit } from 'soroban-toolkit';
import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import { poolsList } from "../src/mappings/poolsList";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables at the beginning of the script
config();

// Retry function with exponential delay
async function retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 2000,
    backoff: number = 2
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        console.log(`⚠️ Retrying in ${delay}ms... (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * backoff, backoff);
    }
}

// Function to get reserves 
async function getPoolReserves(contractId: string): Promise<[bigint, bigint]> {
    try {
        const mainnet = {
            network: "mainnet",
            friendbotUrl: "",
            horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
            sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
            networkPassphrase: process.env.CHAIN_ID as string
        }    

        const sorobanToolkitRsv = createToolkit({
            adminSecret: process.env.SECRET_KEY_HELPER as string,
            contractPaths: {},
            addressBookPath: "",
            customNetworks: [mainnet],
            verbose: "full"
        });
            
        const result = await invokeCustomContract(
            sorobanToolkitRsv.getNetworkToolkit("mainnet"),
            contractId,
            'get_reserves',
            [],
            true,
            Keypair.fromSecret(process.env.SECRET_KEY_HELPER as string)
        );

        const [reserve0, reserve1] = scValToNative(result.result.retval);
        console.log("RESULT 🔴🟣🟢🔵")
        console.log(scValToNative(result.result.retval));
        return [BigInt(reserve0), BigInt(reserve1)];
    } catch (error) {
        console.error(`❌ Error getting reserves for ${contractId}:`, error);
        console.warn(`⚠️ Using default values for pool ${contractId}`);
        return [BigInt(0), BigInt(0)];
    }
}

async function generatePoolReservesList(): Promise<void> {
    const poolReserves: { contract: string; reserve0: string; reserve1: string; }[] = [];
    const failedPools: string[] = [];
    
    try {
        console.log("🚀 Getting reserves from pools...");
        
        for (const [index, contract] of poolsList.entries()) {
            try {
                console.log(`📊 Processing pool ${index + 1}/${poolsList.length}: ${contract}`);
                
                const [reserve0, reserve1] = await retry(() => getPoolReserves(contract));
                
                poolReserves.push({
                    contract,
                    reserve0: reserve0.toString(),
                    reserve1: reserve1.toString()
                });
                
                console.log(`✅ Reserves obtained for: ${contract}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error processing pool ${contract}:`, error);
                failedPools.push(contract);
                continue;
            }
        }

        // Generate file content
        const fileContent = `
// This file is generated automatically by poolRsvMaker.ts
// Do not modify manually

export interface PoolReserves {
    contract: string;
    reserve0: string;
    reserve1: string;
}

export const poolReservesList: PoolReserves[] = ${JSON.stringify(poolReserves, null, 2)};
`;

        // Write file
        const filePath = path.join(__dirname, '../src/mappings/poolRsvList.ts');
        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ poolRsvList.ts file generated successfully`);

    } catch (error) {
        console.error("❌ General error:", error);
        throw error;
    } finally {
        console.log("\n📊 Execution summary:");
        console.log(`✅ Pools processed successfully: ${poolsList.length - failedPools.length}`);
        if (failedPools.length > 0) {
            console.log(`❌ Pools with errors (${failedPools.length}):`);
            failedPools.forEach(pool => console.log(`   - ${pool}`));
        }
    }
}

// Check environment variables
if (!process.env.SOROBAN_ENDPOINT || !process.env.SECRET_KEY_HELPER) {
    console.error("❌ Error: SOROBAN_ENDPOINT and SECRET_KEY_HELPER environment variables are required");
    process.exit(1);
}

generatePoolReservesList()
    .then(() => {
        console.log("✨ Pool reserves list generated successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error generating pool reserves list:", error);
        process.exit(1);
    });