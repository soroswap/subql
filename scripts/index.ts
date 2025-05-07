import { config } from "dotenv";
import { generatePairTokenReservesList } from "./soroswap/pairsTokensMaker";
import { getLatestRouterLedger } from "./soroswap/latestLedger";
import { getPhoenixPreStart } from "./phoenix/pairs";
import { getAquaPreStart } from "./aqua/aquaPoolsTokensMaker";
import { Keypair } from "@stellar/stellar-sdk";
config();

export const { SOROBAN_ENDPOINT, SECRET_KEY_HELPER, NETWORK } = process.env;

function validateEnvVariables() {
  if (!SOROBAN_ENDPOINT || !SECRET_KEY_HELPER) {
    console.error(
      "❌ Error: SOROBAN_ENDPOINT and SECRET_KEY_HELPER environment variables are required"
    );
    process.exit(1);
  }
  
  console.log(`🔧 Initial configuration:`);
  console.log(`🌐 Network: ${NETWORK}`);
  console.log(`🔌 Endpoint: ${SOROBAN_ENDPOINT}`);
  console.log(`🔑 Helper account (public): ${Keypair.fromSecret(SECRET_KEY_HELPER).publicKey()}`);
}

async function main() {
  validateEnvVariables();

  // SOROSWAP
  try {
    console.log(`\n📊 Starting Soroswap processing...`);
    await generatePairTokenReservesList();
    await getLatestRouterLedger();
  } catch (error) {
    console.error("❌ Error generating Soroswap pairs:", error);
  }

  // PHOENIX
  if (NETWORK !== "testnet") {
    try {
      console.log(`\n📊 Starting Phoenix processing...`);
      await getPhoenixPreStart();
    } catch (error) {
      console.error("❌ Error generating Phoenix pairs:", error);
    }
  } else {
    console.log(`\n⏭️ Skipping Phoenix in testnet`);
  }

  // AQUA
  try {
    console.log(`\n📊 Starting Aqua processing...`);
    await getAquaPreStart();
  } catch (error) {
    console.error("❌ Error generating Aqua pairs:", error);
  }

  console.log(`\n🏁 Processing complete`);
  process.exit(1);
}

main();
