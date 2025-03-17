import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock: 56193632,
  },
  testnet: {
    address: "CDFU6AJUBRMCAI4SIC4S3JLCGWUW3GH4N6EDKPJUKYSAZ56TUZIMUYCB",
    startBlock: 1604092,
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return soroswapFactory[network];
}
