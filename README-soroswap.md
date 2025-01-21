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

### Option 2: Manual Setup and Configuration

If you need to customize the implementation, follow these steps:

1. Follow steps 1-2 from Option 1

2. Generate types from schema:
```bash
yarn codegen
```

3. Build the project:
```bash
yarn build
```

4. Start the services:
```bash
yarn start:docker
```

#### Key Configuration Files

- **schema.graphql**: Defines the data structure
- **project.ts**: Contains project configuration and mapping handlers
- **mapping.ts**: Contains the transformation logic

## Sample Queries

### Query Transfers and Accounts
```graphql
{
  query {
    transfers(first: 5, orderBy: VALUE_DESC) {
      totalCount
      nodes {
        id
        date
        ledger
        toId
        fromId
        value
      }
    }
    accounts(first: 5, orderBy: SENT_TRANSFERS_COUNT_DESC) {
      nodes {
        id
        sentTransfers(first: 5, orderBy: LEDGER_DESC) {
          totalCount
          nodes {
            id
            toId
            value
          }
        }
        firstSeenLedger
        lastSeenLedger
      }
    }
  }
}
```
Results:

```
{
  "data": {
    "query": {
      "transfers": {
        "totalCount": 0,
        "nodes": []
      },
      "accounts": {
        "nodes": [
          {
            "id": "gbtbdklzbabdgnpvdygchqzxqxkjfu73ayhls44j7u26ti6lzvlzfg5a",
            "sentTransfers": {
              "totalCount": 0,
              "nodes": []
            },
            "firstSeenLedger": 1700000,
            "lastSeenLedger": 1700000
          },
          {
            "id": "gdea4efymx2vcx7hduurwvuy6de36qihe6faouhuzaldgul4ooq5euvu",
            "sentTransfers": {
              "totalCount": 0,
              "nodes": []
            },
            "firstSeenLedger": 1700000,
            "lastSeenLedger": 1700000
          },
          {
            "id": "gcbwgcat2nhokpnr2toy6o3qdky22lzzeydwh4azhdyyl57qfu53ugzr",
            "sentTransfers": {
              "totalCount": 0,
              "nodes": []
            },
            "firstSeenLedger": 1700000,
            "lastSeenLedger": 1700000
          },
          {
            "id": "gb7yga2xmamr6wqb2z5c4l6s2imudrqzu7zxdpr4df2dewcxpxhmzjy5",
            "sentTransfers": {
              "totalCount": 0,
              "nodes": []
            },
            "firstSeenLedger": 1700000,
            "lastSeenLedger": 1700000
          }
        ]
      }
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
