import { NETWORK } from ".";

const aquaFactory = {
  mainnet: {
    address: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
  },
  testnet: {
    address: "CD23TLIL6DUYAXDVIO6XLEMVVR2KF7XJP6EPTAMF6NBODCXSYK7UIOBB",
  },
};

export function getAquaFactory(network: NETWORK): string {
  console.log(`🔍 Getting Aqua factory address for network: ${network}`);
  console.log(`📝 Found address: ${aquaFactory[network].address}`);
  return aquaFactory[network].address;
}
