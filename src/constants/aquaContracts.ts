import { NETWORK } from ".";

const aquaFactory = {
  mainnet: {
    address: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
  },
  testnet: {
    address: "CDGX6Q3ZZIDSX2N3SHBORWUIEG2ZZEBAAMYARAXTT7M5L6IXKNJMT3GB",
  },
};

export function getAquaFactory(network: NETWORK): string {
  return aquaFactory[network].address;
}
