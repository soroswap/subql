import { NETWORK } from ".";

const aquaFactory = {
  mainnet: {
    address: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
  },
  testnet: {
    address: "CBVHOWNJ5JUQCRIJBIIIZCDY2DFD5TSD5T7ZKKGLMURBODXLSR2RQTKP",
  },
};

export function getAquaFactory(network: NETWORK): string {
  return aquaFactory[network].address;
}
