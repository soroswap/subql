# Soroswap SubQuery Project

0. Clone and edit the `.env`
```bash
git clone https://github.com/soroswap/subql.git
cd subql
cp .env.example .env
```

1. Reset everything you might have from before
```
sudo rm -Rf node_modules
sudo rm -rf .data && sudo rm -rf dist
docker compose down -v
docker stop $(docker ps -aq)
```
2. Run all docker containers
```
docker compose up
```

This will install all packages, do `codegen` and `build` before running subquery.

----------------
----------------


A [SubQuery](https://subquery.network) indexer implementation for the Soroswap project on Stellar Soroban. SubQuery is a fast, flexible, and reliable open-source data indexer that provides custom APIs for web3 projects.

### Prerequisites
- Node.js (v16 or later)
- Docker
- SubQuery CLI (`npm install -g @subql/cli`)

### Option 1: Quick Setup

1. Clone the repository:
```bash
git clone https://github.com/PricesoDan/subql.git
cd subql
cp .env.example .env
```
1.1 Config .env:

```.env Mainnet
SOROBAN_ENDPOINT=https://mainnet.stellar.validationcloud.io/v1/...
SECRET_KEY_HELPER=S...
STARBLOCK=55791918
POSTGRES_PASSWORD=password
POSTGRES_USER=user
POSTGRES_DB=mydb
POSTGRES_PORT=5432
```

2. Install dependencies:

```bash
yarn install
yarn codegen
yarn build
```
3. Config and build the proyect:
There are 3 files: 
- **schema.graphql**: Defines the data structure
- **project.ts**: Contains project configuration and mapping handlers
- **mapping.ts**: Contains the transformation logic

```
source .env
docker compose down -v && sudo rm -rf .data && sudo rm -rf dist
yarn pool-rsv
yarn pairs-rsv
yarn dev
```

Initialize data and project:
```bash
bash ./scripts/init.sh
```
Customizer
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
Dev Mod
```bash
yarn start:docker | tee -a "logs_$(date +%Y%m%d_%H%M%S).txt"
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
query EventSync {
  syncs(orderBy: DATE_DESC) {
    totalCount
    nodes {
      contract
      newReserve0
      newReserve1
    }
  }
}

query SyncDebug {
  syncs(
    filter: {contract: {equalTo: "CDJDRGUCHANJDXALZVJ5IZVB76HX4MWCON5SHF4DE5HB64CBBR7W2ZCD"}}
    orderBy: DATE_DESC
  ) {
    totalCount
    nodes {
      id
      contract
      date
      ledger
      newReserve0
      newReserve1
    }
  }
}
```
Results:


## Maintenance

### Reset Indexing
If you need to reset the indexing:

```bash
yarn reset
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

### Example Event
```
// SYNC EVENT

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyncEvent {
    pub new_reserve_0: i128,
    pub new_reserve_1: i128,
}

pub(crate) fn sync(e: &Env, new_reserve_0: i128, new_reserve_1: i128) {
    let event: SyncEvent = SyncEvent {
        new_reserve_0: new_reserve_0,
        new_reserve_1: new_reserve_1,
    };
    e.events().publish(("SoroswapPair", symbol_short!("sync")), event);
}
```
### Example Contract Mainnet: [CDJDRGUCHANJDXALZVJ5IZVB76HX4MWCON5SHF4DE5HB64CBBR7W2ZCD](https://stellar.expert/explorer/public/contract/CDJDRGUCHANJDXALZVJ5IZVB76HX4MWCON5SHF4DE5HB64CBBR7W2ZCD)

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