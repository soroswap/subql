import { NETWORK } from ".";

const aquaFactory = {
  mainnet: {
    address: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
  },
  testnet: {
    address: "CDFU6AJUBRMCAI4SIC4S3JLCGWUW3GH4N6EDKPJUKYSAZ56TUZIMUYCB",
  },
};

export function getAquaFactory(network: NETWORK): string {
  return aquaFactory[network].address;
}
