import { NETWORK } from ".";

const aquaFactory= {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock: 56105939,
  },
  testnet: {
    address: "CDFU6AJUBRMCAI4SIC4S3JLCGWUW3GH4N6EDKPJUKYSAZ56TUZIMUYCB",
    startBlock: 1569475,
  },
};

export function getAquaFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return aquaFactory[network];
}
