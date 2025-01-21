# SubQuery-Soroswap - Example Project for Stellar Soroban

[SubQuery](https://subquery.network) is a fast, flexible, and reliable open-source data indexer that provides you with custom APIs for your web3 project across all of our supported networks. To learn about how to get started with SubQuery, [visit our docs](https://academy.subquery.network).

**The example project indexes all soroban transfer events on Stellar's Testnet. It also indexes all account payments including credits and debits**

## QuickStart

First, install SubQuery CLI globally on your terminal by using NPM `npm install -g @subql/cli`

You can either clone this GitHub repo:
``` bash
git clone https://github.com/PrincesoDan/subql-soroswap.git
```

```bash
yarn install
```
Config your proyect:
there are 3 files important.
schema.graphql, proyect.ts and mapping.ts. You can check details in the last readme.

Check Startblock in proyect.ts 

```bash
yarn codegen
```
check src/types/models.

```bash
yarn build
```
check proyect.yaml.

```bash
yarn start:docker
```
Next, let's query our project. Follow these three simple steps to query your SubQuery project:

    Open your browser and head to http://localhost:3000.

    You will see a GraphQL playground in the browser and the schemas which are ready to query.

    Find the Docs tab on the right side of the playground which should open a documentation drawer. This documentation is automatically generated and it helps you find what entities and methods you can query.

Try the following queries to understand how it works for your new SubQuery starter project. Don’t forget to learn more about the GraphQL Query language.

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

You will see the result similar to below:

{
  "data": {
    "query": {
      "debits": {
        "totalCount": 1,
        "nodes": [
          {
            "id": "0002576954607800321-0000000002",
            "amount": "10000.0000000",
            "accountId": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
          }
        ]
      },
      "credits": {
        "totalCount": 1,
        "nodes": [
          {
            "id": "0002576924543029249-0000000002",
            "amount": "9999.9999900",
            "accountId": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
          }
        ]
      }
    }
  }
}


### **if need reset** indexing:
navigate to root.

removed cache data
```bash
sudo rm -rf .data
```
stop containers
```bash
docker compose stop
```
removed containers
```bash
docker compose down -v
```



## Start 

Also can use the `subql` CLI to bootstrap a clean project in the network of your choosing by running `subql init` and following the prompts.


Don't forget to install dependencies with `npm install` or `yarn install`!

## Editing your SubQuery project

Although this is a working example SubQuery project, you can edit the SubQuery project by changing the following files:

- The GraphQL Schema (`schema.graphql`) defines the shape of the resulting data that you are using SubQuery to index
- The project manifest in `project.yaml` defines the key project configuration and mapping handler filters
- The Mapping functions in `src/mappings/` directory are typescript functions that handle transformation logic

The **schema.graphql** file determines the shape of your data from SubQuery due to the mechanism of the GraphQL query language. Hence, updating the GraphQL Schema file is the perfect place to start. It allows you to define your end goal right at the start.

**proyect.ts:** The Project Manifest file is an entry point to your project. It defines most of the details on how SubQuery will index and transform the chain data.

For Stellar, there are several types of mapping handlers (and you can have more than one in each project):

    BlockHandler: On each and every block, run a mapping function
    TransactionHandlers: On each and every Stellar/Soroban transaction that matches optional filter criteria, run a mapping function
    OperationHandler: On each and every Stellar operation action that matches optional filter criteria, run a mapping function
    EffectHandler: On each and every Stellar effect action that matches optional filter criteria, run a mapping function
    EventHandler: On each and every Soroban event action that matches optional filter criteria, run a mapping function

Note that the manifest file has already been set up correctly and doesn’t require significant changes, but you need to update the datasource handlers.

**mapping.ts:**

Navigate to the default mapping function in the src/mappings directory.

There are different classes of mapping functions for Stellar; Block handlers, Operation Handlers, and Effect Handlers.

Soroban has two classes of mapping functions; Transaction Handlers, and Event Handlers.



SubQuery supports various layer-1 blockchain networks and provides [dedicated quick start guides](https://academy.subquery.network/quickstart/quickstart.html) as well as [detailed technical documentation](https://academy.subquery.network/build/introduction.html) for each of them.

## Run your project

_If you get stuck, find out how to get help below._

The simplest way to run your project is by running `yarn dev` or `npm run-script dev`. This does all of the following:

1.  `yarn codegen` - Generates types from the GraphQL schema definition and contract ABIs and saves them in the `/src/types` directory. This must be done after each change to the `schema.graphql` file or the contract ABIs
2.  `yarn build` - Builds and packages the SubQuery project into the `/dist` directory
3.  `yarn start:docker`- start.

You can observe the three services start, and once all are running (it may take a few minutes on your first start), please open your browser and head to [http://localhost:3000](http://localhost:3000) - you should see a GraphQL playground showing with the schemas ready to query. [Read the docs for more information](https://academy.subquery.network/run_publish/run.html) or [explore the possible service configuration for running SubQuery](https://academy.subquery.network/run_publish/references.html).

## Query your project

For this project, you can try to query with the following GraphQL code to get a taste of how it works.

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

You can explore the different possible queries and entities to help you with GraphQL using the documentation draw on the right.


## Need Help?

The fastest way to get support is by [searching our documentation](https://academy.subquery.network), or by [joining our discord](https://discord.com/invite/subquery) and messaging us in the `#technical-support` channel.
