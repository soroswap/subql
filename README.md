# Soroswap SubQuery Indexer

A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a powerful and flexible open-source indexing framework that provides custom APIs for web3 projects, enabling efficient and structured data retrieval.

## 🚀 Features

- Indexes Soroswap-specific data on the Stellar Soroban network.
- Provides a GraphQL API for querying indexed data.
- Efficiently processes and stores blockchain data for easy access.
- Docker-based setup for streamlined deployment.

## 📌 Prerequisites

Ensure you have the following installed before setting up the project:

- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/) (Recommended: v18+)
- [NPM](https://www.npmjs.com/)

## ⚙️ Setup and Configuration

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/soroswap/subql.git
cd subql
cp .env.example .env
```

### 2️⃣ Configure Testnet Environment

#### Update Factory Contract Address
Edit the file `src/constants/soroswapContracts.ts` using the factory address from:
https://github.com/soroswap/core/blob/main/public/testnet.contracts.json

Set `startBlock` to a recent block number.

#### Set Environment Variables
```bash
# Set network to testnet in .env file
NETWORK=testnet
```

#### Verify Testnet Endpoints
Ensure all endpoints in your configuration are pointing to testnet.

#### Commit Changes
```bash
git add src/constants/soroswapContracts.ts
git commit -m "Testnet Reset $(date +%Y-%m-%d)"
git push origin main
```

### 3️⃣ Clean Previous Installation (If Necessary)

To ensure a clean setup, remove previous configurations:

```bash
npm run reset
```

### 4️⃣ Install Dependencies

```bash
npm install
```

### 5️⃣ Run Initial Scripts

Prepare the environment by executing:

```bash
npm run prestart
```

### 6️⃣ Start the Indexer

Launch the indexer in development mode:

```bash
npm run dev
```

**Important Note**: For the indexer to function properly, you need to execute a transaction on an existing pool (mint, add liquidity, or swap) to trigger the indexing process.

---
# External Ports
This will run 3 docker containers called, `subql-graphql-engine-1`, `subql-subquery-node-1` and `postgres`.
The ones you will pay attention to are:
- 7000 for the `subql-graphql-engine`
- 5432 for the `postgres`

If you are calling the indexer from a local docker container of the same network, you will need to use:
`GRAPHQL_INDEXER_MAINNET=http://graphql-engine:7000`
---

### 7️⃣ Test Before Deployment

Before deploying to OnFinality, you can test locally:

```bash
npm run dev
```

Then visit http://localhost:7000 to access the GraphQL playground.

**Prerequisites for Testing**:
- Ensure your frontend is working with the new pools
- Execute a transaction (mint, add liquidity, or swap) on an existing pool like XTWR
- Verify that the indexer captures the transaction data

### 8️⃣ Deploy to OnFinality

To deploy to OnFinality, you first need to get the Token from [OnFinality](https://indexing.onfinality.io/). Once you have the token, add it to your `.env` file under `SUBQL_ACCESS_TOKEN` and run:

```bash
npm run build
npm run subql-publish
```

This will build and upload the project to IPFS and return a hash that will be used in OnFinality's deployment.

#### Deployment Steps:

1. **Copy the IPFS Hash** (e.g., `QmabvKWHyYVWV9kEX4KSj2SNRLN8KLcvjVkWiituqxd4Uk`)

2. **Go to OnFinality Dashboard**:
   - Visit https://indexing.onfinality.io/login
   - Navigate to your soroswap project
   - Click "Deploy to Staging Slot"

3. **Configure Advanced Settings**:
   - In Advanced Settings, enable **"Unsafe Flag"** to **TRUE**
   - Paste the IPFS hash from step 1

4. **Test in Staging**:
   - Once deployed, review it in the explorer
   - Execute a swap transaction in your frontend
   - Verify that the indexer is functioning correctly

5. **Move to Production**:
   - After successful testing in staging, move the deployment to production
   - Review again in the explorer to ensure everything works as expected

**Important**: Don't forget to enable the unsafe flag in OnFinality's advanced settings!

## 🛠 Project Structure

The project consists of the following key files:

- **`schema.graphql`**: Defines the GraphQL data schema.
- **`project.ts`**: Contains project-specific configurations and mapping handlers.
- **`mapping.ts`**: Implements data transformation logic for indexing.

### Project Configuration and Event Handlers

The `project.ts` file configures the events to be indexed and how they will be processed. We specifically track events that provide token reserve information across different protocols. Each protocol emits different events that we need to capture to maintain accurate pool data.

#### Protocol Event Handlers

##### Soroswap:

- **Events**: `new_pair` and `sync`
- **Purpose**: Track new pair creation and reserve updates
- **References**:
  - [New Pair Topics](https://github.com/soroswap/core/blob/fdc28f6b0d422263ba509b2ebbc573ac1b897aec/contracts/factory/src/event.rs#L29)
  - [Sync Topics](https://github.com/soroswap/core/blob/fdc28f6b0d422263ba509b2ebbc573ac1b897aec/contracts/pair/src/event.rs#L103)

##### AQUA:

- **Events**: `add_pool`, `trade`, `withdraw`, and `deposit`
- **Purpose**: Monitor pool creation and liquidity changes
- **References**:
  - [Event Functions](https://github.com/AquaToken/soroban-amm/blob/master/liquidity_pool_router/src/events.rs)
  - [Topics](https://github.com/AquaToken/soroban-amm/blob/master/liquidity_pool_events/src/lib.rs)

##### COMET:

- **Events**: `swap`, `deposit`, `withdraw`, `exit_pool`, `join_pool`, and `new_pool`
- **Purpose**: Track pool activities and reserve changes
- **References**:
  - [Event Functions](https://github.com/CometDEX/comet-contracts-v1/blob/ef4cbfad0a35202ad267c14d163d2f362995a8d3/contracts/src/c_pool/event.rs)
  - [Topics](https://github.com/CometDEX/comet-contracts-v1/blob/ef4cbfad0a35202ad267c14d163d2f362995a8d3/contracts/src/c_pool/call_logic/pool.rs)

### 🗂 Pair Table Schema

The following entity schema is used to index liquidity pairs:

```graphql
type SoroswapPair @entity {
  id: ID! # Contract address
  ledger: Int!
  date: Date!
  tokenA: String! @index
  tokenB: String! @index
  reserveA: BigInt!
  reserveB: BigInt!
}

type AquaPair @entity {
  id: ID! # User or Address
  ledger: Int! @index
  date: Date! @index
  address: String! @index
  tokenA: String! @index
  tokenB: String! @index
  poolType: String!
  reserveA: BigInt!
  reserveB: BigInt!
}

type phoenixPair @entity {
  id: ID! # Contract address
  ledger: Int!
  date: Date!
  tokenA: String! @index
  tokenB: String! @index
  reserveA: BigInt!
  reserveB: BigInt!
  reserveLp: BigInt
  stakeAddress: String
  totalFeeBps: Int
}
```

## 📡 Accessing the GraphQL API

Once the indexer is running, access the GraphQL Playground at:

```
http://localhost:7000
```
You can also access from:
https://studio.apollographql.com/sandbox/explorer,
with sandbox `http://localhost:7000`

### 🔍 Example Query

Retrieve the latest indexed pairs:

```graphql
query GetPairsSoroswap {
  soroswapPairs(orderBy: DATE_DESC) {
    totalCount
    nodes {
      id
      tokenA
      tokenB
      reserveA
      reserveB
      ledger
      date
    }
  }
}
query GetPairsAqua {
  aquaPairs(orderBy: DATE_DESC) {
    totalCount
    nodes {
			id
      idx
      ledger
      date
      tokenA
      tokenB
      tokenC
      reserveA
      reserveB
      reserveC
      poolType
      fee
      futureA
      futureATime
      initialA
      initialATime
      precisionMulA
      precisionMulB
      precisionMulC
    }
  }
}
query GetPairsPhoenix{
  phoenixPairs (orderBy: DATE_DESC){
    totalCount
    nodes {
      id
      tokenA
      tokenB
      reserveA
      reserveB
      reserveLp
      stakeAddress
      totalFeeBps
      ledger
      date
    }
  }
}
```

## 📚 Resources

- 📖 [SubQuery Documentation](https://academy.subquery.network)
- 💬 [SubQuery Discord Support](https://discord.com/invite/subquery) (Channel: #technical-support)
- 🔗 [Soroswap Documentation](https://docs.soroswap.finance)

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
