import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
  },
  testnet: {
    address: "CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH",
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
} {
  return soroswapFactory[network];
}
