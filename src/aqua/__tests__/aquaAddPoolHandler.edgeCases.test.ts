import { aquaAddPoolHandler } from "../index";
import { SorobanEvent } from "@subql/types-stellar";
import { AquaPair } from "../../types";
import { extractAddPoolAquaValues } from "../helpers/addPoolEvent";

jest.mock("../helpers/addPoolEvent", () => ({
  extractAddPoolAquaValues: jest.fn(),
}));

jest.mock("../../types", () => ({
  AquaPair: {
    get: jest.fn(),
    create: jest.fn(),
  },
}));

describe("aquaAddPoolHandler - Edge Cases", () => {
  let mockAquaPair: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAquaPair = {
      save: jest.fn(),
    };
  });

  describe("Event Structure Edge Cases", () => {
    it("should handle null event", async () => {
      await expect(aquaAddPoolHandler(null as any)).rejects.toThrow();
    });

    it("should handle undefined event", async () => {
      await expect(aquaAddPoolHandler(undefined as any)).rejects.toThrow();
    });

    it("should handle event without ledgerClosedAt", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle event with null ledgerClosedAt", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: null,
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle event with invalid ledgerClosedAt", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "invalid-date",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle event without ledger", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await expect(aquaAddPoolHandler(event)).rejects.toThrow();
    });

    it("should handle event with null ledger", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: null,
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await expect(aquaAddPoolHandler(event)).rejects.toThrow();
    });

    it("should handle event with missing ledger.sequence", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: {},
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ledger: undefined,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("extractAddPoolAquaValues Edge Cases", () => {
    it("should handle extractAddPoolAquaValues throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockImplementation(() => {
        throw new Error("Extract pool values error");
      });

      await expect(aquaAddPoolHandler(event)).rejects.toThrow("Extract pool values error");
    });

    it("should handle extractAddPoolAquaValues returning null", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue(null);

      await expect(aquaAddPoolHandler(event)).rejects.toThrow();
    });

    it("should handle extractAddPoolAquaValues returning undefined", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue(undefined);

      await expect(aquaAddPoolHandler(event)).rejects.toThrow();
    });

    it("should handle extractAddPoolAquaValues returning empty object", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({});

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: undefined,
          tokenA: undefined,
          tokenB: undefined,
          poolType: undefined,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle extractAddPoolAquaValues with missing required fields", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        // missing idx, tokenA, tokenB, poolType
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "testAddress",
          idx: undefined,
          tokenA: undefined,
          tokenB: undefined,
          poolType: undefined,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Database Operation Edge Cases", () => {
    it("should handle AquaPair.get throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockRejectedValue(new Error("Database get error"));

      await expect(aquaAddPoolHandler(event)).rejects.toThrow("Database get error");
    });

    it("should handle AquaPair.create throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockImplementation(() => {
        throw new Error("Database create error");
      });

      await expect(aquaAddPoolHandler(event)).rejects.toThrow("Database create error");
    });

    it("should handle save operation throwing error", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      mockAquaPair.save.mockRejectedValue(new Error("Save error"));
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await expect(aquaAddPoolHandler(event)).rejects.toThrow("Save error");
    });
  });

  describe("Existing Pool Edge Cases", () => {
    it("should handle existing pool with null date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      const existingPool = { date: null };
      (AquaPair.get as jest.Mock).mockResolvedValue(existingPool);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalled();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle existing pool with invalid date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      const existingPool = { date: "invalid-date" };
      (AquaPair.get as jest.Mock).mockResolvedValue(existingPool);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalled();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle existing pool with more recent date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      const existingPool = { date: new Date("2023-01-02T00:00:00Z") };
      (AquaPair.get as jest.Mock).mockResolvedValue(existingPool);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).not.toHaveBeenCalled();
      expect(mockAquaPair.save).not.toHaveBeenCalled();
    });

    it("should handle existing pool with same date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      const existingPool = { date: new Date("2023-01-01T00:00:00Z") };
      (AquaPair.get as jest.Mock).mockResolvedValue(existingPool);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalled();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle existing pool with older date", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-02T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      const existingPool = { date: new Date("2023-01-01T00:00:00Z") };
      (AquaPair.get as jest.Mock).mockResolvedValue(existingPool);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalled();
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Pool Type Edge Cases", () => {
    it("should handle constant_product pool type", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "constant_product",
          tokenC: "",
          reserveC: BigInt(0),
          futureA: BigInt(0),
          futureATime: BigInt(0),
          initialA: BigInt(0),
          initialATime: BigInt(0),
          precisionMulA: BigInt(0),
          precisionMulB: BigInt(0),
          precisionMulC: BigInt(0),
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle stable pool type", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        tokenC: "tokenC",
        poolType: "stable",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "stable",
          tokenC: "tokenC",
          reserveC: BigInt(0),
          futureA: BigInt(0),
          futureATime: BigInt(0),
          initialA: BigInt(0),
          initialATime: BigInt(0),
          precisionMulA: BigInt(0),
          precisionMulB: BigInt(0),
          precisionMulC: BigInt(0),
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle null pool type", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: null,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: null,
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle undefined pool type", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: undefined,
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: undefined,
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle invalid pool type", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "invalid_type",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "invalid_type",
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Token Edge Cases", () => {
    it("should handle null tokens", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: null,
        tokenB: null,
        tokenC: null,
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenA: null,
          tokenB: null,
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle empty string tokens", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "",
        tokenB: "",
        tokenC: "",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenA: "",
          tokenB: "",
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle tokenC for stable pool", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        tokenC: "tokenC",
        poolType: "stable",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenA: "tokenA",
          tokenB: "tokenB",
          tokenC: "tokenC",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle missing tokenC with empty string default", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        // tokenC is missing
        poolType: "stable",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenA: "tokenA",
          tokenB: "tokenB",
          tokenC: "",
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("Index (idx) Edge Cases", () => {
    it("should handle null idx", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: null,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idx: null,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle undefined idx", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: undefined,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idx: undefined,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle zero idx", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 0,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idx: 0,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle negative idx", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: -1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idx: -1,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });

    it("should handle very large idx", async () => {
      const event: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 999999999,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(event);

      expect(AquaPair.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idx: 999999999,
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });

  describe("JSON.parse/stringify Edge Cases", () => {
    it("should handle event that cannot be stringified", async () => {
      const circularEvent: any = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
      };
      // Create circular reference
      circularEvent.circular = circularEvent;

      await expect(aquaAddPoolHandler(circularEvent)).rejects.toThrow();
    });

    it("should handle event with complex nested structure", async () => {
      const complexEvent: SorobanEvent = {
        contractId: "testContractId",
        ledgerClosedAt: "2023-01-01T00:00:00Z",
        ledger: { sequence: 12345 },
        nestedObject: {
          deeply: {
            nested: {
              value: "test",
            },
          },
        },
      } as unknown as SorobanEvent;

      (extractAddPoolAquaValues as jest.Mock).mockReturnValue({
        address: "testAddress",
        idx: 1,
        tokenA: "tokenA",
        tokenB: "tokenB",
        poolType: "constant_product",
      });

      (AquaPair.get as jest.Mock).mockResolvedValue(null);
      (AquaPair.create as jest.Mock).mockReturnValue(mockAquaPair);

      await aquaAddPoolHandler(complexEvent);

      expect(extractAddPoolAquaValues).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "testContractId",
          nestedObject: {
            deeply: {
              nested: {
                value: "test",
              },
            },
          },
        })
      );
      expect(mockAquaPair.save).toHaveBeenCalled();
    });
  });
});