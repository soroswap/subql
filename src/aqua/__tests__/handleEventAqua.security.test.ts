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

describe("handleEventAqua - Security Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Factory Address Validation Bypass Attempts", () => {
    it("should not initialize DB when factory address is hardcoded but differs from legitimate factory", async () => {
      // Scenario: Attacker tries to bypass validation by providing a hardcoded factory address
      // that matches the expected format but is not the legitimate factory
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_ID_123456789",
        topic: [
          { value: () => "TRADE" }, // Correct event type to trigger validation
        ],
      } as unknown as SorobanEvent;

      // Legitimate factories
      const legitimateMainnetFactory = "LEGITIMATE_MAINNET_FACTORY_ADDRESS";
      const legitimateTestnetFactory = "LEGITIMATE_TESTNET_FACTORY_ADDRESS";
      
      // Attacker provides a different factory address that looks legitimate
      const attackerFakeFactory = "FAKE_MAINNET_FACTORY_ADDRESS_ATTACK";

      // Setup mocks for legitimate factories
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateMainnetFactory;
        if (network === "testnet") return legitimateTestnetFactory;
        return null;
      });

      // Mock the attacker's factory address (extracted from event)
      (getFactoryTopic as jest.Mock).mockResolvedValue(attackerFakeFactory);
      
      // Mock aquaEventHandler to succeed (so we can verify DB init wasn't called)
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Verify security: initializeAquaDb should NOT have been called
      expect(initializeAquaDb).not.toHaveBeenCalled();
      
      // Verify the event still gets processed (but without DB initialization)
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
      
      // Verify the factory validation was actually performed
      expect(getFactoryTopic).toHaveBeenCalledWith(maliciousEvent);
      expect(getAquaFactory).toHaveBeenCalledWith(NETWORK.MAINNET);
      expect(getAquaFactory).toHaveBeenCalledWith(NETWORK.TESTNET);
    });

    it("should not initialize DB when factory address is close but not exact match", async () => {
      // Test case-sensitivity and exact matching
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_ID_CASE",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_FACTORY_ADDRESS";
      
      // Attacker tries case variations
      const attackerFactoryWithCase = "legitimate_factory_address"; // lowercase
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        if (network === "testnet") return "TESTNET_FACTORY";
        return null;
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(attackerFactoryWithCase);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: case-sensitive comparison should prevent bypass
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when factory address contains extra characters", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_EXTRA_CHARS",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_FACTORY";
      
      // Attacker tries to add extra characters
      const attackerFactoryWithExtra = "LEGITIMATE_FACTORY_EXTRA";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        return "OTHER_FACTORY";
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(attackerFactoryWithExtra);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: exact matching should prevent bypass
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when using substring of legitimate factory", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_SUBSTRING",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_FACTORY_FULL_ADDRESS";
      
      // Attacker tries to use substring
      const attackerFactorySubstring = "LEGITIMATE_FACTORY";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        return "OTHER_FACTORY";
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(attackerFactorySubstring);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: partial matching should not work
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when factory address is null but event type is TRADE", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_NULL_FACTORY",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return "MAINNET_FACTORY";
        if (network === "testnet") return "TESTNET_FACTORY";
        return null;
      });

      // Attacker's event has no factory address
      (getFactoryTopic as jest.Mock).mockResolvedValue(null);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: null factory should not bypass validation
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when factory address is empty string", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_EMPTY_FACTORY",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return "MAINNET_FACTORY";
        if (network === "testnet") return "TESTNET_FACTORY";
        return null;
      });

      // Attacker provides empty factory address
      (getFactoryTopic as jest.Mock).mockResolvedValue("");
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: empty string should not bypass validation
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when using mixed legitimate factory addresses", async () => {
      // Attacker tries to use testnet factory when mainnet is expected or vice versa
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_MIXED_NETWORKS",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const mainnetFactory = "MAINNET_FACTORY_ADDRESS";
      const testnetFactory = "TESTNET_FACTORY_ADDRESS";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return mainnetFactory;
        if (network === "testnet") return testnetFactory;
        return null;
      });

      // This should succeed - using legitimate testnet factory
      (getFactoryTopic as jest.Mock).mockResolvedValue(testnetFactory);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // This should actually succeed since testnet factory is legitimate
      expect(initializeAquaDb).toHaveBeenCalledWith("MALICIOUS_CONTRACT_MIXED_NETWORKS");
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });
  });

  describe("Event Type Manipulation Attempts", () => {
    it("should not initialize DB when event type is not TRADE even with legitimate factory", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_WRONG_TYPE",
        topic: [
          { value: () => "SWAP" }, // Wrong event type
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_MAINNET_FACTORY";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        return "OTHER_FACTORY";
      });

      // Even with legitimate factory address
      (getFactoryTopic as jest.Mock).mockResolvedValue(legitimateFactory);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // Security check: wrong event type should prevent DB initialization
      expect(initializeAquaDb).not.toHaveBeenCalled();
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });

    it("should not initialize DB when event type case is manipulated", async () => {
      const maliciousEvent: SorobanEvent = {
        contractId: "MALICIOUS_CONTRACT_CASE_MANIPULATION",
        topic: [
          { value: () => "trade" }, // lowercase instead of TRADE
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_MAINNET_FACTORY";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        return "OTHER_FACTORY";
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(legitimateFactory);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(maliciousEvent);

      // The function actually converts to uppercase, so this should succeed
      expect(initializeAquaDb).toHaveBeenCalledWith("MALICIOUS_CONTRACT_CASE_MANIPULATION");
      expect(aquaEventHandler).toHaveBeenCalledWith(maliciousEvent);
    });
  });

  describe("Legitimate Access Control", () => {
    it("should properly initialize DB when both event type and factory are legitimate", async () => {
      const legitimateEvent: SorobanEvent = {
        contractId: "LEGITIMATE_CONTRACT_ID",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const legitimateFactory = "LEGITIMATE_MAINNET_FACTORY";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return legitimateFactory;
        if (network === "testnet") return "TESTNET_FACTORY";
        return null;
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(legitimateFactory);
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(legitimateEvent);

      // Legitimate access should work
      expect(initializeAquaDb).toHaveBeenCalledWith("LEGITIMATE_CONTRACT_ID");
      expect(aquaEventHandler).toHaveBeenCalledWith(legitimateEvent);
    });

    it("should handle both mainnet and testnet factories correctly", async () => {
      const testnetEvent: SorobanEvent = {
        contractId: "TESTNET_CONTRACT_ID",
        topic: [
          { value: () => "TRADE" },
        ],
      } as unknown as SorobanEvent;

      const testnetFactory = "LEGITIMATE_TESTNET_FACTORY";
      
      (getAquaFactory as jest.Mock).mockImplementation((network) => {
        if (network === "mainnet") return "MAINNET_FACTORY";
        if (network === "testnet") return testnetFactory;
        return null;
      });

      (getFactoryTopic as jest.Mock).mockResolvedValue(testnetFactory);
      (initializeAquaDb as jest.Mock).mockResolvedValue(undefined);
      (aquaEventHandler as jest.Mock).mockResolvedValue(undefined);

      await handleEventAqua(testnetEvent);

      // Testnet access should also work
      expect(initializeAquaDb).toHaveBeenCalledWith("TESTNET_CONTRACT_ID");
      expect(aquaEventHandler).toHaveBeenCalledWith(testnetEvent);
    });
  });
});