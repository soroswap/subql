import { createToolkit } from "soroban-toolkit";
import { Networks } from "@stellar/stellar-sdk";
import { NETWORK } from "../src/constants";
import { config } from "dotenv";
config();

// Sleep function to implement delays between calls
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function with exponential delay
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 100,
  backoff: number = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Check specifically for rate limit errors
    if (error?.response?.status === 429) {
      console.log(`⚠️ Rate limit reached (429). Retrying with longer delay.`);
      // Use a longer initial delay for rate limit errors
      if (retries === 0) throw error;
      console.log(`⚠️ Retrying in ${delay*2}ms... (${retries} attempts remaining)`);
      await sleep(delay*2);
      return retry(fn, retries - 1, delay * backoff, backoff);
    }
    
    if (retries === 0) throw error;
    console.log(`⚠️ Retrying in ${delay}ms... (${retries} attempts remaining)`);
    await sleep(delay);
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

// Add this at the top level of the file
const network = {
  network: process.env.NETWORK as string,
  friendbotUrl: "",
  horizonRpcUrl: process.env.HORIZON_ENDPOINT as string,
  sorobanRpcUrl: process.env.SOROBAN_ENDPOINT as string,
  networkPassphrase:
    (process.env.NETWORK as NETWORK) === NETWORK.MAINNET
      ? Networks.PUBLIC
      : Networks.TESTNET,
};

const sorobanToolkit = createToolkit({
  adminSecret: process.env.SECRET_KEY_HELPER as string,
  contractPaths: {},
  addressBookPath: "",
  customNetworks: [network],
  verbose: "full",
});

// Create a single instance of networkToolkit
export const toolkit = sorobanToolkit.getNetworkToolkit(
  process.env.NETWORK as string
);
