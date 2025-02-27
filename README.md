# Soroswap SubQuery Project

A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a flexible and reliable open-source data indexer that provides custom APIs for web3 projects.

## Prerequisites

- Docker

## Setup and Configuration

### 1. Initial Setup

Clone the repository and set up the environment:
```bash
git clone https://github.com/soroswap/subql.git
cd subql
cp .env.example .env
```

Note: If STARTBLOCK is empty in the .env file, the indexer will start from the latest ledger in mainnet.

### 2. Clean Previous Installation

If needed, reset your environment:
```bash
sudo rm -Rf node_modules
sudo rm -rf .data && sudo rm -rf dist
docker compose down -v
docker stop $(docker ps -aq)
```

### 3. Initialize and Run

#### Initialize Pair Table
To recreate the Pair table, run:
```bash
source .env 
docker compose up -d app
docker compose exec app sh -c "yarn install && yarn pairs-rsv"
```

#### Start the Service
```bash
source .env
docker compose up
```

### Development Mode

To run with logging:
```bash
docker compose up | tee -a "logs_$(date +%Y%m%d_%H%M%S).txt"
```
    This will install all packages, do `codegen` and `build` before running subquery.
If you want clean cache
```bash
docker compose up -d app
docker compose exec app yarn cache clean
```

## Project Configuration

The project consists of three main files:

1. **schema.graphql**: Defines the data structure
2. **project.ts**: Contains project configuration and mapping handlers
3. **mapping.ts**: Contains the transformation logic

### Pair Table Schema
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

## GraphQL Interface

Access the GraphQL playground at `http://localhost:3000`

### Example Query

```graphql
query GetLatestPairs {
  pairs {
    totalCount
    nodes {
      address
      tokenA
      tokenB
      reserveA
      reserveB
    }
  }
}
```

----------------
----------------
## Known Issues

1. **Mapping Logic Limitation**: The ScvalToNative function doesn't work inside the subql-node container in the sandbox environment. As a workaround, we use direct event parsing. See the helper functions in the mapping for implementation details.

## Resources

- [SubQuery Documentation](https://academy.subquery.network)
- [SubQuery Discord Support](https://discord.com/invite/subquery) - Channel: #technical-support
- [Soroswap Documentation](https://docs.soroswap.finance)