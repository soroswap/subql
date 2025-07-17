import { extractAquaValues } from "../helpers/events";
import { getTransactionData } from "../helpers/utils";

jest.mock("../helpers/utils", () => ({
  getTransactionData: jest.fn(),
}));

describe("extractAquaValues - Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Event Structure Edge Cases", () => {
    it("should handle null event", async () => {
      const result = await extractAquaValues(null);

      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should handle undefined event", async () => {
      const result = await extractAquaValues(undefined);

      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should handle event without txHash", async () => {
      const event = {
        contractId: { toString: () => "testContractId" },
      };

      const result = await extractAquaValues(event);

      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
    });

    it("should handle event with null txHash", async () => {
      const event = {
        txHash: null,
        contractId: { toString: () => "testContractId" },
      };

      const result = await extractAquaValues(event);

      expect(result.address).toBe("");
    });

    it("should handle event with txHash that throws on toString", async () => {
      const event = {
        txHash: { toString: () => { throw new Error("txHash toString error"); } },
        contractId: { toString: () => "testContractId" },
      };

      const result = await extractAquaValues(event);
      
      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
    });

    it("should handle event without contractId", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
      };

      const result = await extractAquaValues(event);

      expect(result.address).toBe("");
    });

    it("should handle event with null contractId", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: null,
      };

      const result = await extractAquaValues(event);

      expect(result.address).toBe("");
    });

    it("should handle event with contractId that throws on toString", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => { throw new Error("contractId toString error"); } },
      };

      const result = await extractAquaValues(event);
      
      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
    });
  });

  describe("getTransactionData Edge Cases", () => {
    it("should handle getTransactionData throwing error", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockImplementation(() => {
        throw new Error("Transaction data error");
      });

      const result = await extractAquaValues(event);
      
      expect(result.address).toBe("testContractId");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
    });

    it("should handle getTransactionData returning null", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue(null);

      const result = await extractAquaValues(event);

      expect(result.address).toBe("testContractId");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should handle getTransactionData returning undefined", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue(undefined);

      const result = await extractAquaValues(event);

      expect(result.address).toBe("testContractId");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should handle getTransactionData returning empty object", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({});

      const result = await extractAquaValues(event);

      expect(result.address).toBe("testContractId");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBe(BigInt(0));
      expect(result.reserveB).toBe(BigInt(0));
    });
  });

  describe("Token Data Edge Cases", () => {
    it("should handle missing tokenA", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("tokenB_address");
    });

    it("should handle missing tokenB", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenA).toBe("tokenA_address");
      expect(result.tokenB).toBe("");
    });

    it("should handle null token values", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: null,
        tokenB: null,
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
    });

    it("should handle tokenC for stable pools", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        tokenC: "tokenC_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        reserveC: BigInt(3000),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenA).toBe("tokenA_address");
      expect(result.tokenB).toBe("tokenB_address");
      expect(result.tokenC).toBe("tokenC_address");
      expect(result.reserveC).toBe(BigInt(3000));
    });
  });

  describe("Reserve Data Edge Cases", () => {
    it("should handle missing reserveA", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBe(BigInt(2000));
    });

    it("should handle missing reserveB", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBe(BigInt(1000));
      expect(result.reserveB).toBeUndefined();
    });

    it("should handle null reserve values", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: null,
        reserveB: null,
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBeNull();
      expect(result.reserveB).toBeNull();
    });

    it("should handle zero reserve values", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(0),
        reserveB: BigInt(0),
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should use default values when both reserves are undefined", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });

    it("should not use default values when only one reserve is undefined", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBe(BigInt(1000));
      expect(result.reserveB).toBeUndefined();
    });
  });

  describe("Fee Data Edge Cases", () => {
    it("should handle missing fee", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.fee).toBeUndefined();
    });

    it("should handle null fee", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        fee: null,
      });

      const result = await extractAquaValues(event);

      expect(result.fee).toBeNull();
    });

    it("should handle zero fee", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        fee: BigInt(0),
      });

      const result = await extractAquaValues(event);

      expect(result.fee).toBe(BigInt(0));
    });
  });

  describe("Stable Pool Specific Edge Cases", () => {
    it("should handle all stable pool fields undefined", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenC).toBeUndefined();
      expect(result.reserveC).toBeUndefined();
      expect(result.futureA).toBeUndefined();
      expect(result.futureATime).toBeUndefined();
      expect(result.initialA).toBeUndefined();
      expect(result.initialATime).toBeUndefined();
      expect(result.precisionMulA).toBeUndefined();
      expect(result.precisionMulB).toBeUndefined();
      expect(result.precisionMulC).toBeUndefined();
    });

    it("should handle all stable pool fields null", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        tokenC: null,
        reserveC: null,
        futureA: null,
        futureATime: null,
        initialA: null,
        initialATime: null,
        precisionMulA: null,
        precisionMulB: null,
        precisionMulC: null,
      });

      const result = await extractAquaValues(event);

      expect(result.tokenC).toBeUndefined();
      expect(result.reserveC).toBeUndefined();
      expect(result.futureA).toBeUndefined();
      expect(result.futureATime).toBeUndefined();
      expect(result.initialA).toBeUndefined();
      expect(result.initialATime).toBeUndefined();
      expect(result.precisionMulA).toBeUndefined();
      expect(result.precisionMulB).toBeUndefined();
      expect(result.precisionMulC).toBeUndefined();
    });

    it("should handle mixed stable pool field values", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        tokenC: "tokenC_address",
        reserveC: BigInt(3000),
        futureA: BigInt(100),
        futureATime: undefined,
        initialA: null,
        initialATime: BigInt(1672531200),
        precisionMulA: BigInt(1000000),
        precisionMulB: BigInt(2000000),
        precisionMulC: undefined,
      });

      const result = await extractAquaValues(event);

      expect(result.tokenC).toBe("tokenC_address");
      expect(result.reserveC).toBe(BigInt(3000));
      expect(result.futureA).toBe(BigInt(100));
      expect(result.futureATime).toBeUndefined();
      expect(result.initialA).toBeNull();
      expect(result.initialATime).toBe(BigInt(1672531200));
      expect(result.precisionMulA).toBe(BigInt(1000000));
      expect(result.precisionMulB).toBe(BigInt(2000000));
      expect(result.precisionMulC).toBeUndefined();
    });

    it("should handle zero values for stable pool fields", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
        tokenC: "",
        reserveC: BigInt(0),
        futureA: BigInt(0),
        futureATime: BigInt(0),
        initialA: BigInt(0),
        initialATime: BigInt(0),
        precisionMulA: BigInt(0),
        precisionMulB: BigInt(0),
        precisionMulC: BigInt(0),
      });

      const result = await extractAquaValues(event);

      expect(result.tokenC).toBe("");
      expect(result.reserveC).toBe(BigInt(0));
      expect(result.futureA).toBe(BigInt(0));
      expect(result.futureATime).toBe(BigInt(0));
      expect(result.initialA).toBe(BigInt(0));
      expect(result.initialATime).toBe(BigInt(0));
      expect(result.precisionMulA).toBe(BigInt(0));
      expect(result.precisionMulB).toBe(BigInt(0));
      expect(result.precisionMulC).toBe(BigInt(0));
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle error and return partial result", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: BigInt(1000),
        reserveB: BigInt(2000),
      });

      const result = await extractAquaValues(event);

      expect(result.address).toBe("testContractId");
      expect(result.tokenA).toBe("tokenA_address");
      expect(result.tokenB).toBe("tokenB_address");
      expect(result.reserveA).toBe(BigInt(1000));
      expect(result.reserveB).toBe(BigInt(2000));
    });

    it("should handle complete failure and return empty result", async () => {
      const event = {
        txHash: { toString: () => { throw new Error("Critical error"); } },
        contractId: { toString: () => "testContractId" },
      };

      const result = await extractAquaValues(event);

      expect(result.address).toBe("");
      expect(result.tokenA).toBe("");
      expect(result.tokenB).toBe("");
      expect(result.reserveA).toBeUndefined();
      expect(result.reserveB).toBeUndefined();
    });
  });

  describe("Large Number Edge Cases", () => {
    it("should handle very large BigInt values", async () => {
      const event = {
        txHash: { toString: () => "testTxHash" },
        contractId: { toString: () => "testContractId" },
      };

      const largeValue = BigInt("99999999999999999999999999999999999999");

      (getTransactionData as jest.Mock).mockReturnValue({
        tokenA: "tokenA_address",
        tokenB: "tokenB_address",
        reserveA: largeValue,
        reserveB: largeValue,
        fee: largeValue,
        futureA: largeValue,
        futureATime: largeValue,
        initialA: largeValue,
        initialATime: largeValue,
        precisionMulA: largeValue,
        precisionMulB: largeValue,
        precisionMulC: largeValue,
      });

      const result = await extractAquaValues(event);

      expect(result.reserveA).toBe(largeValue);
      expect(result.reserveB).toBe(largeValue);
      expect(result.fee).toBe(largeValue);
      expect(result.futureA).toBe(largeValue);
      expect(result.futureATime).toBe(largeValue);
      expect(result.initialA).toBe(largeValue);
      expect(result.initialATime).toBe(largeValue);
      expect(result.precisionMulA).toBe(largeValue);
      expect(result.precisionMulB).toBe(largeValue);
      expect(result.precisionMulC).toBe(largeValue);
    });
  });
});