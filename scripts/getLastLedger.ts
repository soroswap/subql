import { rpc } from "@stellar/stellar-sdk";
import 'dotenv/config'; // Load environment variables
import * as fs from 'fs';
import * as path from 'path';

// Default Soroban endpoint
const SOROBAN_ENDPOINT = process.env.SOROBAN_ENDPOINT || 'https://soroban-testnet.stellar.org';

// Helper function to get the latest ledger
async function getLatestLedger(): Promise<number> {
    try {
      const server = new rpc.Server(SOROBAN_ENDPOINT);
      const response = await server.getLatestLedger();
      return response.sequence;
    } catch (error) {
      console.error("Error getting latest ledger:", error);
      return 0; // Default value in case of error
    }
}

const getStartBlock = async () => {
    return parseInt(process.env.STARBLOCK!) || await getLatestLedger();
};

// Main function that executes everything
async function main() {
    const startBlock = await getStartBlock();
    console.log("startBlock: " + startBlock);
    
    // Save the value in a TypeScript file
    const outputPath = path.join(__dirname, 'lastLedger.ts');
    const fileContent = `
// This file is automatically generated - do not edit manually
export const startBlock = ${startBlock};
`;
    fs.writeFileSync(outputPath, fileContent);
}

// Execute main function
main()
    .catch(error => {
        console.error("Error:", error);
        process.exit(1);
    });