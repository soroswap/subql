import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock:     56740542,
  },
  testnet: {
    address: "CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH",
    startBlock: 84371,
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return soroswapFactory[network];
}
