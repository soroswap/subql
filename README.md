# Soroswap SubQuery Project

A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a flexible, and reliable open-source data indexer that provides custom APIs for web3 projects.

### Prerequisites

- Docker

### Run and config

0. Clone and edit the `.env`
```bash
git clone https://github.com/soroswap/subql.git
cd subql
cp .env.example .env
```
in .env, if STARBLOCK is empty the indexer start from lastledger in mainnet.

1. Reset everything you might have from before
```bash
sudo rm -Rf node_modules
sudo rm -rf .data && sudo rm -rf dist
docker compose down -v
docker stop $(docker ps -aq)
```
2. Run all docker containers
```bash
docker compose up
```
Dev mod
```bash
docker compose up | tee -a "logs_$(date +%Y%m%d_%H%M%S).txt"
```
This will install all packages, do `codegen` and `build` before running subquery.

----------------
----------------
## Current issues:
1. The main issue is that if the startBlock is not the current ledger, the indexed block continues to drift further away from the current ledger.
1.1. Slow indexing: Increasing the --batch-size and --workers parameters sometimes causes the RPC to collapse, throwing the error: ERROR: limit request. We suspect this could be due to either the RPC or the handling logic. We’d like to reduce the number of RPC queries, as we believe there are too many.
1.2. Console logs (with log-level=debug) indicate an issue related to writing to the database.

2. Mapping logic issue: I encountered another issue specific to the ScvalToNative function, which does not work inside the subql-node container in the sandbox. I’m not sure why. Because of this, I need to resort to "scraping" and directly parsing events. You can check the helper functions in the mapping for more details.



3. Config and build the proyect:
There are 3 files: 
- **schema.graphql**: Defines the data structure
- **project.ts**: Contains project configuration and mapping handlers
- **mapping.ts**: Contains the transformation logic


The GraphQL playground will be available at `http://localhost:3000`.

## Sample Queries

### Query Transfers and Accounts
```graphql
query GetLatestPairs {
  newPairs(orderBy: DATE_DESC, first: 10) {
    nodes {
      id
      ledger
      date
      tokenA
      tokenB
      address
      newPairsLength
    }
  }
}
query GetSyncByAddress {
  syncs {
    nodes {
      id
      ledger
      date
      address
      reserveA
      reserveB
    }
  }
}

```


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