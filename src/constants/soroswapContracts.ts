import { NETWORK } from ".";

const soroswapFactory = {
  mainnet: {
    address: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    startBlock: 56931112,
  },
  testnet: {
    address: "CBEEH4UPEYYJIT6INNYMXOXP5UTN6IBU3NKQFOFUYCZM2IHYITW6N22Z",
    startBlock: 15631,
  },
};

export function getSoroswapFactory(network: NETWORK): {
  address: string;
  startBlock: number;
} {
  return soroswapFactory[network];
}
