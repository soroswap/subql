import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
  SubqlRuntimeHandler,
} from "@subql/types-stellar";
import { Networks } from "@stellar/stellar-sdk";
import { config } from "dotenv";
import {
  getCometFactory,
  getPhoenixFactory,
  getSoroswapFactory,
  NETWORK,
} from "./src/constants";
config();

// Soroswap Handlers
const soroswapFactory = getSoroswapFactory(process.env.NETWORK as NETWORK);
const soroswapHandlers: SubqlRuntimeHandler[] = [
  {
    handler: "handleSoroswapEventSync",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["SoroswapPair", "sync"],
    },
  },
  {
    handler: "handleSoroswapEventNewPair",
    kind: StellarHandlerKind.Event,
    filter: {
      contractId: soroswapFactory.address,
      topics: ["SoroswapFactory", "new_pair"],
    },
  },
];

// Phoenix Handlers
const phoenixFactory = getPhoenixFactory(process.env.NETWORK as NETWORK);
const phoenixHandlers: SubqlRuntimeHandler[] = [
  {
    handler: "handlePhoenixEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["swap", "sender"],
    },
  },
  {
    handler: "handlePhoenixEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["provide_liquidity", "sender"],
    },
  },
  {
    handler: "handlePhoenixEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["withdraw_liquidity", "sender"],
    },
  },
  {
    handler: "handlePhoenixCreateLPEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      contractId: phoenixFactory,
      topics: ["create", "liquidity_pool"],
    },
  },
];

const cometFactory = getCometFactory(process.env.NETWORK as NETWORK);
const cometHandlers: SubqlRuntimeHandler[] = [
  {
    handler: "handleCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["POOL", "deposit"],
    },
  },
  {
    handler: "handleCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["POOL", "swap"],
    },
  },
  {
    handler: "handleCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["POOL", "withdraw"],
    },
  },
  {
    handler: "handleCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["POOL", "join_pool"],
    },
  },
  {
    handler: "handleCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      topics: ["POOL", "exit_pool"],
    },
  },
  {
    handler: "handleNewPoolCometEvent",
    kind: StellarHandlerKind.Event,
    filter: {
      contractId: cometFactory,
      topics: ["LOG", "NEW_POOL"],
    },
  },
];

/* This is your project configuration */
const project: StellarProject = {
  specVersion: "1.0.0",
  name: "soroswap-indexer",
  version: "0.0.1",
  runner: {
    node: {
      name: "@subql/node-stellar",
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
    chainId:
      (process.env.NETWORK as NETWORK) === NETWORK.MAINNET
        ? Networks.PUBLIC
        : Networks.TESTNET,
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: process.env.HORIZON_ENDPOINT!?.split(",") as string[] | string,
    /* This is a specific Soroban endpoint
      It is only required when you are using a soroban/EventHandler */
    sorobanEndpoint: process.env.SOROBAN_ENDPOINT!,
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      /* Set this as a logical start block, it might be block 1 (genesis) or when your contract was deployed */
      startBlock: soroswapFactory.startBlock,
      mapping: {
        file: "./dist/index.js",
        handlers: [...soroswapHandlers, ...phoenixHandlers, ...cometHandlers],
      },
    },
  ],
};

// Must set default to the project instance
export default project;
