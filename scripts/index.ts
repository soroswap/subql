import { config } from "dotenv";
import { generatePairTokenReservesList } from "./soroswap/pairsTokensMaker";
import { getLatestRouterLedger } from "./soroswap/latestLedger";
import { getPhoenixPreStart } from "./phoenix/pairs";
import { getCometPreStart } from "./comet/pairs";

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
    // SOROSWAP
    await generatePairTokenReservesList();
    await getLatestRouterLedger();

    // PHOENIX
    await getPhoenixPreStart();

    // COMET
    await getCometPreStart();
    console.log("✨ Pairs, tokens and reserves list generated successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating list:", error);
    process.exit(1);
  }
}

main();
