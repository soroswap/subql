import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock: 57956835,
  },
  testnet: {
    address: "CB7X4DSYW4UTKJSJMO7A3ZX2YQQG4NQUD3TQOTAZ7UHOK2BGGLRW2ZIC",
    startBlock: 604134,
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return soroswapFactory[network];
}
