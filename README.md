# Soroswap SubQuery Project

A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a fast, flexible, and reliable open-source data indexer that provides custom APIs for web3 projects.

This project indexes Soroban transfer events and account payments (credits/debits) on Stellar's Testnet.

## Quick Start Guide

### Prerequisites
- Node.js (v16 or later)
- Docker
- SubQuery CLI (`npm install -g @subql/cli`)

### Option 1: Quick Setup

1. Clone the repository:
```bash
git clone https://github.com/PricesoDan/subql-soroswap.git
cd subql-soroswap
```


**Check Startblock in proyect.ts** 

2. Install dependencies:

```bash
yarn install
```
3. Config and build the proyect:
There are 3 files: 
- **schema.graphql**: Defines the data structure
- **project.ts**: Contains project configuration and mapping handlers
- **mapping.ts**: Contains the transformation logic

```bash
yarn codegen
```
check src/types/models.

```bash
yarn build
```
check proyect.yaml.

4. Start the project:
```bash
yarn start:docker
```

The GraphQL playground will be available at `http://localhost:3000`.

```graphql
query {
  credits {
    totalCount
    nodes {
      id
      amount
      accountId
    }
  }
  debits {
    totalCount
    nodes {
      id
      amount
      accountId
    }
  }
}
```

## Maintenance

### Reset Indexing
If you need to reset the indexing:

1. Remove cached data:
```bash
sudo rm -rf .data
```

2. Stop containers:
```bash
docker compose stop
```

3. Remove containers:
```bash
docker compose down -v
```

## Advanced Configuration

### Mapping Handlers
The project supports various types of handlers for both Stellar and Soroban:

**Stellar Handlers:**
- BlockHandler
- TransactionHandler
- OperationHandler
- EffectHandler

**Soroban Handlers:**
- TransactionHandler
- EventHandler

### Customization
To customize the implementation:

1. Update the GraphQL schema in `schema.graphql`
2. Modify handler configurations in `project.ts`
3. Implement custom logic in `src/mappings/`
4. Run `yarn codegen` after schema changes
5. Build and restart the project

## Support

- [SubQuery Documentation](https://academy.subquery.network)
- [Discord Support](https://discord.com/invite/subquery) - Channel: #technical-support
- [Soroswap Documentation](https://docs.soroswap.finance)
