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

### 2️⃣ Clean Previous Installation (If Necessary)

To ensure a clean setup, remove previous configurations:

```bash
npm run reset
```

### 3️⃣ Install Dependencies

```bash
npm install
```

### 4️⃣ Run Initial Scripts

Prepare the environment by executing:

```bash
npm run prestart
```

### 5️⃣ Start the Indexer

Launch the indexer in development mode:

```bash
npm run dev
```

### 6️⃣ Deploy to OnFinality

To deploy to OnFinality, you first need to get the Token from [OnFinality](https://indexing.onfinality.io/). Once you have the token, add it to your `.env` file under `SUBQL_ACCESS_TOKEN` and run:

```bash
npm run subql-publish
```

This will build and upload the project to IPFS and return a hash that will be used in OnFinality's deployment.

## 🛠 Project Structure

The project consists of the following key files:

- **`schema.graphql`**: Defines the GraphQL data schema.
- **`project.ts`**: Contains project-specific configurations and mapping handlers.
- **`mapping.ts`**: Implements data transformation logic for indexing.

### 🗂 Pair Table Schema

The following entity schema is used to index liquidity pairs:

```graphql
SoroswapPair entity: Stores pair data and current reserves
"""
type SoroswapPair @entity {
  id: ID! # Contract address
  ledger: Int!
  date: Date!
  tokenA: String! @index
  tokenB: String! @index
  reserveA: BigInt!
  reserveB: BigInt!
}

"""
AquaPair entity: Stores Aqua swap events
"""
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

```

## 📡 Accessing the GraphQL API

Once the indexer is running, access the GraphQL Playground at:

```
http://localhost:3000
```

### 🔍 Example Query

Retrieve the latest indexed pairs:

```graphql
query GetPairsSoroswap {
  soroswapPairs (orderBy: DATE_DESC) {
    totalCount
    nodes {
			id
      tokenA
      tokenB
      reserveA
      reserveB
    }
  }
}
query GetPairsAqua {
  aquaPairs {
    totalCount
    nodes {
      id
      tokenA
      tokenB
      reserveA
      reserveB
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
