# Soroswap SubQuery Project

A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a flexible and reliable open-source data indexer that provides custom APIs for web3 projects.

#### Prerequisites

- Docker

## Run and config

0. Clone and edit the `.env`
```bash
git clone https://github.com/soroswap/subql.git
cd subql
cp .env.example .env
```

    Check .env, if STARBLOCK is empty the indexer start from lastledger in mainnet.

1. Reset everything you might have from before
```bash
sudo rm -Rf node_modules
sudo rm -rf .data && sudo rm -rf dist
docker compose down -v
docker stop $(docker ps -aq)
```

2. Run all docker containers
if you want recreate table Pair
```bash
source .env 
docker compose up -d app
docker compose exec app sh -c "yarn install && yarn pairs-rsv"
```
Run
```bash
source .env
docker compose up
```
Dev mod
```bash
docker compose up | tee -a "logs_$(date +%Y%m%d_%H%M%S).txt"
```
    This will install all packages, do `codegen` and `build` before running subquery.

3. Config proyect:
There are 3 files: 
- **schema.graphql**: Defines the data structure
- **project.ts**: Contains project configuration and mapping handlers
- **mapping.ts**: Contains the transformation logic

## GraphQL

The GraphQL playground will be available at `http://localhost:3000`.

#### Examples Queries

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
## Current issues:

1. The main issue is that if the startBlock is not the current ledger, the indexed block continues to drift further away from the current ledger.
1.1. Slow indexing: Increasing the --batch-size and --workers parameters sometimes causes the RPC to collapse, throwing the error: ERROR: limit request. We suspect this could be due to either the RPC or the handling logic. We’d like to reduce the number of RPC queries, as we believe there are too many.
1.2. Console logs (with log-level=debug) indicate an issue related to writing to the database.

2. Mapping logic issue: I encountered another issue specific to the ScvalToNative function, which does not work inside the subql-node container in the sandbox. I’m not sure why. Because of this, I need to resort to "scraping" and directly parsing events. You can check the helper functions in the mapping for more details.

## Support

- [SubQuery Documentation](https://academy.subquery.network)
- [Discord Support](https://discord.com/invite/subquery) - Channel: #technical-support
- [Soroswap Documentation](https://docs.soroswap.finance)