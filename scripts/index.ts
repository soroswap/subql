import { config } from "dotenv";
import { generatePairTokenReservesList } from "./soroswap/pairsTokensMaker";
import { getLatestRouterLedger } from "./soroswap/latestLedger";

config();

export const { SOROBAN_ENDPOINT, SECRET_KEY_HELPER, NETWORK } = process.env;

function validateEnvVariables() {
  if (!SOROBAN_ENDPOINT || !SECRET_KEY_HELPER) {
    console.error(
      "❌ Error: SOROBAN_ENDPOINT and SECRET_KEY_HELPER environment variables are required"
    );
    process.exit(1);
  }
}

async function main() {
  validateEnvVariables();
  try {
    await generatePairTokenReservesList();
    await getLatestRouterLedger();
    console.log("✨ Pairs, tokens and reserves list generated successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating list:", error);
    process.exit(1);
  }
}

main();
