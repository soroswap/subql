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
  extractAquaValues: jest.fn(),
}));

jest.mock("../../constants", () => ({
  getAquaFactory: jest.fn(),
  NETWORK: {
    MAINNET: "mainnet",
    TESTNET: "testnet",
  },
}));

describe("handleEventAqua", () => {
  const mockEvent: SorobanEvent = {
    contractId: "testContractId",
    topic: [
      { value: () => "TRADE" },
    ],
  } as unknown as SorobanEvent;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize Aqua DB and call aquaEventHandler for TRADE events with valid factory address", async () => {
    (getFactoryTopic as jest.Mock).mockResolvedValue("mainnet");
    (getAquaFactory as jest.Mock).mockImplementation((network) => network);

    await handleEventAqua(mockEvent);

    expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
    expect(initializeAquaDb).toHaveBeenCalledWith("testContractId");
    expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
  });

  it("should not initialize Aqua DB for TRADE events with invalid factory address", async () => {
    (getFactoryTopic as jest.Mock).mockResolvedValue("invalidFactory");

    await handleEventAqua(mockEvent);

    expect(getFactoryTopic).toHaveBeenCalledWith(mockEvent);
    expect(initializeAquaDb).not.toHaveBeenCalled();
    expect(aquaEventHandler).toHaveBeenCalledWith(mockEvent);
  });

  it("should call aquaEventHandler for non-TRADE events", async () => {
    const nonTradeEvent: SorobanEvent = {
      ...mockEvent,
      topic: [
        { value: () => "NON_TRADE" },
      ],
    } as unknown as SorobanEvent;

    (getFactoryTopic as jest.Mock).mockResolvedValue("someFactory");

    await handleEventAqua(nonTradeEvent);

    expect(getFactoryTopic).toHaveBeenCalledWith(nonTradeEvent);
    expect(initializeAquaDb).not.toHaveBeenCalled();
    expect(aquaEventHandler).toHaveBeenCalledWith(nonTradeEvent);
  });
});
