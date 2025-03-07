import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from "@subql/types-stellar";
import { startBlock } from "./scripts/lastLedger";
import * as dotenv from "dotenv";
import path from "path";
import { Networks } from "@stellar/stellar-sdk";

const mode = process.env.NODE_ENV || "production";

// Load the appropriate .env file
const dotenvPath = path.resolve(
  __dirname,
  `.env${mode !== "production" ? `.${mode}` : ""}`
);
dotenv.config({ path: dotenvPath });

/* This is your project configuration */
const project: StellarProject = {
  specVersion: "1.0.0",
  name: "soroswap-indexer",
  version: "0.0.1",
  runner: {
    node: {
      name: "@subql/node-stellar",
      // options: {
      //   unsafe: true
      // },
      version: "*",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  description: "Soroswap Indexer",
  repository: "https://github.com/soroswap/subql",
  schema: {
    file: "./schema.graphql",
  },
  network: {
    /* Stellar and Soroban uses the network passphrase as the chainId
      'Test SDF Network ; September 2015' for testnet
      'Public Global Stellar Network ; September 2015' for mainnet
      'Test SDF Future Network ; October 2022' for Future Network */
    chainId: Networks.PUBLIC,
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: [
      "https://newest-autumn-energy.stellar-mainnet.quiknode.pro/b9c096bbb70d53afa791ad08425ddb2f65fa2559",
    ],
    /* This is a specific Soroban endpoint
      It is only required when you are using a soroban/EventHandler */
    sorobanEndpoint:
      "https://newest-autumn-energy.stellar-mainnet.quiknode.pro/b9c096bbb70d53afa791ad08425ddb2f65fa2559",
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      /* Set this as a logical start block, it might be block 1 (genesis) or when your contract was deployed */
      startBlock: startBlock,
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            handler: "handleEventSync",
            kind: StellarHandlerKind.Event,
            filter: {
              //contractId: "CDJDRGUCHANJDXALZVJ5IZVB76HX4MWCON5SHF4DE5HB64CBBR7W2ZCD",
              topics: [
                "SoroswapPair",
                "sync", // Topic para el evento sync
              ],
            },
          },
          {
            handler: "handleEventNewPair",
            kind: StellarHandlerKind.Event,
            filter: {
              contractId:
                "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
              topics: ["SoroswapFactory", "new_pair"],
            },
          },
        ],
      },
    },
  ],
};

// Must set default to the project instance
export default project;
