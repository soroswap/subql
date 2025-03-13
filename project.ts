import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
  SubqlRuntimeHandler,
} from "@subql/types-stellar";
import { Networks } from "@stellar/stellar-sdk";
import { config } from "dotenv";
import { getSoroswapFactory, NETWORK } from "./src/constants";
config();
// Soroswap handlers
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

//Aqua handlers
const aquaHandlers: SubqlRuntimeHandler[] = [
  {
    handler: "handleEventAddPoolAqua",
    kind: StellarHandlerKind.Event,
    filter: {
      contractId:"CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
      topics: [
        "add_pool"
      ],
    },
  },
  {
    handler: "handleEventAqua",// deposit liquidity
    kind: StellarHandlerKind.Event,
    filter: {
      topics: [
        "deposit_liquidity"
      ],
    },
  },
  {
    handler: "handleEventAqua",// withdraw liquidity
    kind: StellarHandlerKind.Event,
    filter: {
      topics: [
        "withdraw_liquidity"
      ],
    },
  },
  {
    handler: "handleEventAqua",// swap liquidity
    kind: StellarHandlerKind.Event,
    filter: {
      topics: [
        "trade"
      ],
    },
  },
]

/* This is your project configuration */
const project: StellarProject = {
  specVersion: "1.0.0",
  name: "soroswap-indexer",
  version: "0.0.1",
  runner: {
    node: {
      name: "@subql/node-stellar",
      options: {
        unsafe: true
      },
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
      //startBlock: soroswapFactory.startBlock,
      startBlock: 56132154,
      mapping: {
        file: "./dist/index.js",
        handlers: [...soroswapHandlers, ...aquaHandlers],
      },
    },
  ],
};

// Must set default to the project instance
export default project;
