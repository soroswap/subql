import { NETWORK } from ".";

const phoenixFactory = {
  mainnet: {
    address: "CB4SVAWJA6TSRNOJZ7W2AWFW46D5VR4ZMFZKDIKXEINZCZEGZCJZCKMI",
  },
  testnet: {
    address: "CAAKDCJKACY37N7NLS4CVNCIGI3O7SREOWR6N4RWB2OZ3NLMIAR6AK2O",
  },
};

export function getPhoenixFactory(network: NETWORK): string {
  return phoenixFactory[network].address;
}
