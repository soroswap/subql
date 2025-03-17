import { NETWORK } from ".";

const cometFactory = {
  mainnet: {
    address: "CA2LVIPU6HJHHPPD6EDDYJTV2QEUBPGOAVJ4VIYNTMFUCRM4LFK3TJKF",
  },
  testnet: {
    address: "CCALIBNFFI472TK2O36XHU3ZTESPA5G333UHQKTTOI7ZQEBGBEIQHNLO",
  },
};

const cometPools = {
  mainnet: [
    "CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM",
    "CB3A6LUPSJPD7WQ7TETCWL3Z3SSPV4QW2K6FB3CH5LIPKDAZOVWBUTV4",
  ],
  testnet: ["CBCEVGU5YQAASFEBHCL6KGWXUXBFWPPJUSVQEAAA2G5ZEOFUN2NIL5T7"],
};

export function getCometFactory(network: NETWORK): string {
  return cometFactory[network].address;
}

export function getCometPools(network: NETWORK): string[] {
  return cometPools[network];
}
