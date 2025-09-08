import { NETWORK } from ".";

const defindexFactory = {
  mainnet: {
    address: "CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI",
  },
  testnet: {
    address: "CD6MEVYGXCCUTOUIC3GNMIDOSRY4A2WGCRQGOOCVG5PK2N7UNGGU6BBQ",
  },
};

export function getDefindexFactory(network: NETWORK): string {
  return defindexFactory[network].address;
}
