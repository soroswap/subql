import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock: 58686020,
  },
  testnet: {
    address: "CDJTMBYKNUGINFQALHDMPLZYNGUV42GPN4B7QOYTWHRC4EE5IYJM6AES",
    startBlock: 328162,
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return soroswapFactory[network];
}
