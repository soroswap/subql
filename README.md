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
rm -rf node_modules
rm -rf .data dist
docker compose down -v
docker stop $(docker ps -aq)
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

## 🛠 Project Structure

The project consists of the following key files:

- **`schema.graphql`**: Defines the GraphQL data schema.
- **`project.ts`**: Contains project-specific configurations and mapping handlers.
- **`mapping.ts`**: Implements data transformation logic for indexing.

### 🗂 Pair Table Schema

The following entity schema is used to index liquidity pairs:

```graphql
type Pair @entity {
  id: ID! # Contract address
  ledger: Int!
  date: Date!
  tokenA: String! @index
  tokenB: String! @index
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
query GetLatestPairs {
  pairs {
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
