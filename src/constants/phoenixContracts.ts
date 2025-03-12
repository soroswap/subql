import { NETWORK } from ".";

const phoenixMultihop = {
  mainnet: {
    address: "CCLZRD4E72T7JCZCN3P7KNPYNXFYKQCL64ECLX7WP5GNVYPYJGU2IO2G",
  },
  testnet: {
    address: "XXX",
  },
};

const phoenixFactory = {
  mainnet: {
    address: "CB4SVAWJA6TSRNOJZ7W2AWFW46D5VR4ZMFZKDIKXEINZCZEGZCJZCKMI",
  },
  testnet: {
    address: "XXX",
  },
};

export function getPhoenixMultihop(network: NETWORK): string {
  return phoenixMultihop[network].address;
}

export function getPhoenixFactory(network: NETWORK): string {
  return phoenixFactory[network].address;
}
