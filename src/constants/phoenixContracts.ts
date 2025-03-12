import { NETWORK } from ".";

const phoenixMultihop = {
  mainnet: {
    address: "CCLZRD4E72T7JCZCN3P7KNPYNXFYKQCL64ECLX7WP5GNVYPYJGU2IO2G",
    startBlock: 56115256,
  },
  testnet: {
    address: "XXX",
    startBlock: 1569475,
  },
};

const phoenixFactory = {
  mainnet: {
    address: "CB4SVAWJA6TSRNOJZ7W2AWFW46D5VR4ZMFZKDIKXEINZCZEGZCJZCKMI",
    startBlock: 56115256,
  },
  testnet: {
    address: "XXX",
    startBlock: 1569475,
  },
};

export function getPhoenixMultihop(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return phoenixMultihop[network];
}

export function getPhoenixFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return phoenixFactory[network];
}
