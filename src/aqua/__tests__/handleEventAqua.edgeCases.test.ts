import { handleEventAqua } from "../../mappings/mappingHandlers";
import { SorobanEvent } from "@subql/types-stellar";
import { initializeAquaDb } from "../../aqua/initialize";
import { aquaEventHandler } from "../../aqua";
import { getFactoryTopic } from "../../aqua/helpers/events";
import { getAquaFactory, NETWORK } from "../../constants";

jest.mock("../initialize", () => ({
  initializeAquaDb: jest.fn(),
}));

jest.mock("../index", () => ({
  aquaEventHandler: jest.fn(),
}));

jest.mock("../helpers/events", () => ({
  getFactoryTopic: jest.fn(),
}));

jest.mock("../../constants", () => ({
  getAquaFactory: jest.fn(),
  NETWORK: {
    MAINNET: "mainnet",
    TESTNET: "testnet",
  },
}));

describe("handleEventAqua - Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Event Structure Edge Cases", () => {
    it("should handle missing event.topic[0]", async () => {
      const eventWithoutTopic: SorobanEvent = {
        contractId: "testContractId",
        topic: [],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");

      await handleEventAqua(eventWithoutTopic);

      expect(getFactoryTopic).toHaveBeenCalledWith(eventWithoutTopic);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(eventWithoutTopic);
    });

    it("should handle null/undefined event topic value", async () => {
      const eventWithNullTopic: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => null },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");

      await handleEventAqua(eventWithNullTopic);

      expect(getFactoryTopic).toHaveBeenCalledWith(eventWithNullTopic);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(eventWithNullTopic);
    });

    it("should handle event topic value throwing error", async () => {
      const eventWithErrorTopic: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => { throw new Error("Topic parsing error"); } },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");

      await expect(handleEventAqua(eventWithErrorTopic)).rejects.toThrow("Topic parsing error");
    });

    it("should handle undefined contractId", async () => {
      const eventWithoutContractId: SorobanEvent = {
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);

      await expect(handleEventAqua(eventWithoutContractId)).rejects.toThrow();
    });
  });

  describe("Factory Address Edge Cases", () => {
    it("should handle getFactoryTopic throwing error", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockRejectedValue(new Error("Factory topic error"));

      await expect(handleEventAqua(mockEvent)).rejects.toThrow("Factory topic error");
    });

    it("should handle null factory address", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue(null);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle empty string factory address", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("");

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("Network and Factory Validation Edge Cases", () => {
    it("should handle getAquaFactory throwing error", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation(() => {
        throw new Error("Factory config error");
      });

      await expect(handleEventAqua(mockEvent)).rejects.toThrow("Factory config error");
    });

    it("should handle undefined NETWORK constants", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation(() => undefined);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("Event Type Matching Edge Cases", () => {
    it("should handle case insensitive TRADE event", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "trade" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle mixed case TRADE event", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TrAdE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle numeric event type", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => 12345 },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle object event type", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => ({ type: "TRADE" }) },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("Database Initialization Edge Cases", () => {
    it("should handle initializeAquaDb throwing error", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);
      (initializeAquaDb as jest.Mock).mockRejectedValue(new Error("DB initialization error"));

      await expect(handleEventAqua(mockEvent)).rejects.toThrow("DB initialization error");
    });

    it("should handle aquaEventHandler throwing error", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockRejectedValue(new Error("Event handler error"));

      await expect(handleEventAqua(mockEvent)).rejects.toThrow("Event handler error");
    });
  });

  describe("Complex Factory Matching Edge Cases", () => {
    it("should handle both mainnet and testnet factory matches", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("testnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle factory address with extra whitespace", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue(" mainnet ");
      (getAquaFactory as jest.Mock).mockImplementation((network) => network);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("Multiple Network Scenarios", () => {
    it("should handle when factory matches mainnet but not testnet", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return "mainnet";
        return "different_testnet";
      });
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle when factory matches testnet but not mainnet", async () => {
      const mockEvent: SorobanEvent = {
        contractId: "testContractId",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getFactoryTopic as jest.Mock).mockResolvedValue("testnet");
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "testnet") return "testnet";
        return "different_mainnet";
      });
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(mockEvent);

      expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
      expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
      expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
    });
  });
});