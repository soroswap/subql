import { createToolkit } from "soroban-toolkit";
import { Networks } from "@stellar/stellar-sdk";
import { NETWORK } from "../src/constants";
import { config } from "dotenv";
config();

// Retry function with exponential delay
export async function retry<T>(
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
    await new Promise((resolve) => setTimeout(resolve, delay));
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
