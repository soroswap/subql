import { aquaEventHandler } from "../index";
import { SorobanEvent } from "@subql/types-stellar";
import { AquaPair } from "../../types";
import { extractAquaValues } from "../helpers/events";

jest.mock("../helpers/events", () => ({
  extractAquaValues: jest.fn(),
}));

jest.mock("../../types", () => ({
  AquaPair: {
    get: jest.fn(),
  },
}));

describe("aquaEventHandler - Edge Cases", () => {
  let mockAquaPair: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAquaPair = {
      reserveA: BigInt(1000),
      reserveB: BigInt(2000),
      reserveC: BigInt(3000),
      fee: BigInt(30),
      date: new Date("2023-01-01"),
      ledger: 12345,
      poolType: "constant_product",
      futureA: BigInt(100),
      futureATime: BigInt(1672531200),
      initialA: BigInt(50),
      initialATime: BigInt(1672531200),
      precisionMulA: BigInt(1000000),
      precisionMulB: BigInt(1000000),
      precisionMulC: BigInt(1000000),
      tokenC: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      save: jest.fn(),
    };
  });

  describe("Event Structure Edge Cases", () => {
    it("should handle missing event.topic[0]", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).toHaveBeenCalledWith("testAddress");
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle null event.topic[0].value()", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => null }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle event.topic[0].value() throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => { throw new Error("Topic value error"); } }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await expect(aquaEventHandler(event)).rejects.toThrow("Topic value error");
    });
  });

  describe("extractAquaValues Edge Cases", () => {
    it("should handle extractAquaValues throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockRejectedValue(new Error("Extract values error"));

      await expect(aquaEventHandler(event)).rejects.toThrow("Extract values error");
    });

    it("should handle extractAquaValues returning null address", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: null,
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).not.toHaveBeenCalled();
    });

    it("should handle extractAquaValues returning empty string address", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).not.toHaveBeenCalled();
    });

    it("should handle extractAquaValues returning undefined address", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: undefined,
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).not.toHaveBeenCalled();
    });
  });

  describe("Database Operation Edge Cases", () => {
    it("should handle AquaPair.get throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockRejectedValue(new Error("Database error"));

      await expect(aquaEventHandler(event)).rejects.toThrow("Database error");
    });

    it("should handle pool not found (null result)", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).toHaveBeenCalledWith("testAddress");
    });

    it("should handle pool not found (undefined result)", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(undefined);

      await aquaEventHandler(event);

      expect(extractAquaValues).toHaveBeenCalledWith(event);
      expect(AquaPair.get).toHaveBeenCalledWith("testAddress");
    });

    it("should handle save operation throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      mockAquaPair.save.mockRejectedValue(new Error("Save error"));
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await expect(aquaEventHandler(event)).rejects.toThrow("Save error");
    });
  });

  describe("Date Comparison Edge Cases", () => {
    it("should handle invalid ledgerClosedAt date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "invalid-date",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle null ledgerClosedAt", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: null,
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      // When currentDate is Invalid Date, comparison with any date returns false
      // so it will proceed to update and save
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).not.toHaveBeenCalled();
    });

    it("should handle existing pool with invalid date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      mockAquaPair.date = "invalid-date";
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle existing pool with null date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      mockAquaPair.date = null;
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should skip update when existing pool is more recent", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      mockAquaPair.date = new Date("2023-01-02T00:00:00Z");
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).not.toHaveBeenCalled();
    });
  });

  describe("Data Update Edge Cases", () => {
    it("should handle undefined reserves in eventData", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: undefined,
        reserveB: undefined,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.reserveA).toBeUndefined();
      expect(mockAquaPair.reserveB).toBeUndefined();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle null reserves in eventData", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: null,
        reserveB: null,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.reserveA).toBeNull();
      expect(mockAquaPair.reserveB).toBeNull();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle missing ledger sequence", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: {},
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.ledger).toBeUndefined();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Stable Pool Edge Cases", () => {
    it("should handle stable pool with all fields undefined", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        reserveC: undefined,
        futureA: undefined,
        futureATime: undefined,
        initialA: undefined,
        initialATime: undefined,
        precisionMulA: undefined,
        precisionMulB: undefined,
        precisionMulC: undefined,
        tokenC: undefined,
      });

      mockAquaPair.poolType = "stable";
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle stable pool with mixed defined/undefined fields", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        reserveC: BigInt(3500),
        futureA: undefined,
        futureATime: BigInt(1672531300),
        initialA: undefined,
        initialATime: BigInt(1672531300),
        precisionMulA: BigInt(2000000),
        precisionMulB: undefined,
        precisionMulC: BigInt(3000000),
        tokenC: "NEWTOKEN",
      });

      mockAquaPair.poolType = "stable";
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.reserveC).toBe(BigInt(3500));
      expect(mockAquaPair.futureATime).toBe(BigInt(1672531300));
      expect(mockAquaPair.initialATime).toBe(BigInt(1672531300));
      expect(mockAquaPair.precisionMulA).toBe(BigInt(2000000));
      expect(mockAquaPair.precisionMulC).toBe(BigInt(3000000));
      expect(mockAquaPair.tokenC).toBe("NEWTOKEN");
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle non-stable pool with stable fields present", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        reserveC: BigInt(3500),
        futureA: BigInt(200),
        futureATime: BigInt(1672531300),
        initialA: BigInt(150),
        initialATime: BigInt(1672531300),
        precisionMulA: BigInt(2000000),
        precisionMulB: BigInt(2000000),
        precisionMulC: BigInt(3000000),
        tokenC: "NEWTOKEN",
      });

      mockAquaPair.poolType = "constant_product";
      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      // Stable pool fields should not be updated for non-stable pools
      expect(mockAquaPair.reserveC).toBe(BigInt(3000));
      expect(mockAquaPair.futureA).toBe(BigInt(100));
      expect(mockAquaPair.tokenC).toBe("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Fee Handling Edge Cases", () => {
    it("should handle undefined fee", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        fee: undefined,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.fee).toBe(BigInt(30));
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle null fee", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        fee: null,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.fee).toBe(null); // Fee is set to null, not preserved
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle zero fee", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        topic: [{ value: () => "SWAP" }],
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12346 },
      } as unknown as SorobanEvent;

      (extractAquaValues as jest.Mock).mockResolvedValue({
        address: "testAddress",
        reserveA: BigInt(1500),
        reserveB: BigInt(2500),
        fee: BigInt(0),
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(mockAquaPair);

      await aquaEventHandler(event);

      expect(mockAquaPair.fee).toBe(BigInt(0));
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });
});