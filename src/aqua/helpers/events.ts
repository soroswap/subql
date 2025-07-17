import { StrKey } from "@stellar/stellar-sdk";
import { getTransactionData } from "./utils";
import { SorobanEvent } from "@subql/types-stellar";

// Types and Interfaces
interface ContractData {
  tokenA?: any;
  tokenB?: any;
  tokenC?: any;
  reserveA?: any;
  reserveB?: any;
  reserveC?: any;
  fee?: any;
  futureA?: any;
  futureATime?: any;
  initialA?: any;
  initialATime?: any;
  precisionMulA?: any;
  precisionMulB?: any;
  precisionMulC?: any;
}

interface AquaValues {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  reserveA: bigint;
  reserveB: bigint;
  reserveC?: bigint;
  fee?: bigint;
  futureA?: bigint;
  futureATime?: bigint;
  initialA?: bigint;
  initialATime?: bigint;
  precisionMulA?: bigint;
  precisionMulB?: bigint;
  precisionMulC?: bigint;
}

// Enums for field types and behaviors
enum FieldType {
  STRING = 'string',
  OPTIONAL_STRING = 'optional_string',
  RESERVE_BIGINT = 'reserve_bigint',
  REGULAR_BIGINT = 'regular_bigint',
  OPTIONAL_BIGINT = 'optional_bigint'
}

// Value normalizer strategy interface
interface ValueNormalizer<T> {
  normalize(value: any): T;
}

// Concrete normalizer implementations
class StringNormalizer implements ValueNormalizer<string> {
  normalize(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  }
}

class OptionalStringNormalizer implements ValueNormalizer<string | undefined> {
  normalize(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return String(value);
  }
}

class ReserveBigIntNormalizer implements ValueNormalizer<bigint | undefined | null> {
  normalize(value: any): bigint | undefined | null {
    if (value === null) return null;
    if (value === undefined) return undefined;
    
    const converted = this.convertToBigInt(value);
    // Zero reserves become undefined
    return converted === BigInt(0) ? undefined : converted;
  }

  private convertToBigInt(value: any): bigint | undefined {
    if (typeof value === 'bigint') return value;
    
    if (typeof value === 'number' || typeof value === 'string') {
      try {
        return BigInt(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

class RegularBigIntNormalizer implements ValueNormalizer<bigint | undefined | null> {
  normalize(value: any): bigint | undefined | null {
    if (value === null) return null;
    if (value === undefined) return undefined;
    if (typeof value === 'bigint') return value;
    
    if (typeof value === 'number' || typeof value === 'string') {
      try {
        return BigInt(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

class OptionalBigIntNormalizer implements ValueNormalizer<bigint | undefined> {
  normalize(value: any): bigint | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'bigint') return value;
    
    if (typeof value === 'number' || typeof value === 'string') {
      try {
        return BigInt(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

// Factory for creating normalizers
class NormalizerFactory {
  private static normalizers = new Map<FieldType, ValueNormalizer<any>>([
    [FieldType.STRING, new StringNormalizer()],
    [FieldType.OPTIONAL_STRING, new OptionalStringNormalizer()],
    [FieldType.RESERVE_BIGINT, new ReserveBigIntNormalizer()],
    [FieldType.REGULAR_BIGINT, new RegularBigIntNormalizer()],
    [FieldType.OPTIONAL_BIGINT, new OptionalBigIntNormalizer()]
  ]);

  static getNormalizer<T>(type: FieldType): ValueNormalizer<T> {
    const normalizer = this.normalizers.get(type);
    if (!normalizer) {
      throw new Error(`Unknown field type: ${type}`);
    }
    return normalizer;
  }
}

// Field configuration for different types of fields
interface FieldConfig {
  type: FieldType;
  logName?: string;
  isRequired?: boolean;
}

// Field processor that handles validation, normalization, and logging
class FieldProcessor {
  constructor(
    private logger: any,
    private contractData: ContractData,
    private allStableFieldsAreNull: boolean
  ) {}

  processField<T>(
    resultKey: keyof AquaValues,
    contractKey: keyof ContractData,
    config: FieldConfig,
    result: Partial<AquaValues>
  ): void {
    const contractValue = this.contractData[contractKey];
    if (contractValue === undefined) return;

    let normalizedValue: T;

    // Special handling for stable pool fields when all are null
    if (this.allStableFieldsAreNull && this.isStablePoolField(contractKey)) {
      normalizedValue = undefined as T;
    } else {
      const normalizer = NormalizerFactory.getNormalizer<T>(config.type);
      normalizedValue = normalizer.normalize(contractValue);
    }

    (result as any)[resultKey] = normalizedValue;

    // Log if value exists and is loggable
    if (this.shouldLog(normalizedValue, config)) {
      const logName = config.logName || String(contractKey);
      this.logFieldValue(logName, normalizedValue);
    }
  }

  private isStablePoolField(key: keyof ContractData): boolean {
    const stableFields: (keyof ContractData)[] = [
      'tokenC', 'reserveC', 'futureA', 'futureATime', 
      'initialA', 'initialATime', 'precisionMulA', 
      'precisionMulB', 'precisionMulC'
    ];
    return stableFields.includes(key);
  }

  private shouldLog(value: any, config: FieldConfig): boolean {
    return value !== undefined && value !== null && Boolean(config.logName);
  }

  private logFieldValue(logName: string, value: any): void {
    const displayValue = typeof value === 'bigint' ? value.toString() : value;
    this.logger.debug(`[AQUA] → ${logName} from contract: ${displayValue}`);
  }
}

// Main extractor class that orchestrates the extraction process
class AquaValuesExtractor {
  private static readonly STABLE_POOL_FIELDS: (keyof ContractData)[] = [
    'tokenC', 'reserveC', 'futureA', 'futureATime', 
    'initialA', 'initialATime', 'precisionMulA', 
    'precisionMulB', 'precisionMulC'
  ];

  private static readonly FIELD_CONFIGS: Record<string, FieldConfig> = {
    tokenA: { type: FieldType.STRING, logName: 'TokenA' },
    tokenB: { type: FieldType.STRING, logName: 'TokenB' },
    reserveA: { type: FieldType.RESERVE_BIGINT, logName: 'ReserveA' },
    reserveB: { type: FieldType.RESERVE_BIGINT, logName: 'ReserveB' },
    fee: { type: FieldType.REGULAR_BIGINT, logName: 'Fee' },
    tokenC: { type: FieldType.OPTIONAL_STRING, logName: 'TokenC' },
    reserveC: { type: FieldType.OPTIONAL_BIGINT, logName: 'ReserveC' },
    futureA: { type: FieldType.OPTIONAL_BIGINT, logName: 'FutureA' },
    futureATime: { type: FieldType.OPTIONAL_BIGINT, logName: 'FutureATime' },
    initialA: { type: FieldType.REGULAR_BIGINT, logName: 'InitialA' },
    initialATime: { type: FieldType.OPTIONAL_BIGINT, logName: 'InitialATime' },
    precisionMulA: { type: FieldType.OPTIONAL_BIGINT, logName: 'PrecisionMulA' },
    precisionMulB: { type: FieldType.OPTIONAL_BIGINT, logName: 'PrecisionMulB' },
    precisionMulC: { type: FieldType.OPTIONAL_BIGINT, logName: 'PrecisionMulC' }
  };

  constructor(private logger: any) {}

  private createInitialResult(): Partial<AquaValues> {
    return {
      address: "",
      tokenA: "",
      tokenB: "",
      tokenC: undefined,
      reserveA: undefined,
      reserveB: undefined,
      reserveC: undefined,
      fee: undefined,
      futureA: undefined,
      futureATime: undefined,
      initialA: undefined,
      initialATime: undefined,
      precisionMulA: undefined,
      precisionMulB: undefined,
      precisionMulC: undefined,
    };
  }

  private extractEventAddress(event: any): string {
    try {
      this.logger.debug(`txHash: ${event.txHash.toString()}`);
      return event.contractId.toString();
    } catch {
      return "";
    }
  }

  private checkAllStableFieldsAreNull(contractData: ContractData): boolean {
    const definedStableFields = AquaValuesExtractor.STABLE_POOL_FIELDS
      .filter(field => contractData[field] !== undefined);
    
    return definedStableFields.length > 0 && 
           definedStableFields.every(field => contractData[field] === null);
  }

  private processAllFields(
    contractData: ContractData, 
    result: Partial<AquaValues>, 
    allStableFieldsAreNull: boolean
  ): void {
    const processor = new FieldProcessor(this.logger, contractData, allStableFieldsAreNull);

    // Process each field using configuration
    Object.entries(AquaValuesExtractor.FIELD_CONFIGS).forEach(([key, config]) => {
      processor.processField(
        key as keyof AquaValues,
        key as keyof ContractData,
        config,
        result
      );
    });
  }

  private applyDefaultValues(contractData: ContractData, result: Partial<AquaValues>): void {
    // Apply default values only for empty contract data
    if (Object.keys(contractData).length === 0) {
      this.logger.debug(`⚠️ No reserve data found for contract ${result.address}, using default values`);
      result.reserveA = BigInt(0);
      result.reserveB = BigInt(0);
    }
  }

  async extract(event: any): Promise<AquaValues> {
    const result = this.createInitialResult();

    try {
      // Extract basic event information
      result.address = this.extractEventAddress(event);

      if (!result.address) {
        return result as AquaValues;
      }

      // Get contract data
      this.logger.debug(`🔍 Fetching contract data for ${result.address}...`);
      const contractData = getTransactionData(event, result.address);

      // Analyze stable pool field state
      const allStableFieldsAreNull = this.checkAllStableFieldsAreNull(contractData);

      // Process all fields
      this.processAllFields(contractData, result, allStableFieldsAreNull);

      // Apply default values if needed
      this.applyDefaultValues(contractData, result);

      return result as AquaValues;
    } catch (error) {
      this.logger.error(`[AQUA] ❌ Error extracting Aqua values: ${error}`);
      return result as AquaValues;
    }
  }
}

// Factory topic extractor class
class FactoryTopicExtractor {
  constructor(private logger: any) {}

  async extract(event: SorobanEvent): Promise<string> {
    let factoryAddress: string;

    try {
      if (event.topic[3]) {
        if (event.topic[3].address().switch().name === "scAddressTypeContract") {
          const contractIdBuffer = event.topic[3].address().contractId();
          factoryAddress = StrKey.encodeContract(contractIdBuffer);
        }
      }
    } catch (error) {
      this.logger.error(`Error getting factory address: ${error}`);
    }

    return factoryAddress;
  }
}

// Public API functions (maintaining backward compatibility)
export async function extractAquaValues(event: any): Promise<AquaValues> {
  const extractor = new AquaValuesExtractor(logger);
  return extractor.extract(event);
}

export async function getFactoryTopic(event: any): Promise<string> {
  const extractor = new FactoryTopicExtractor(logger);
  return extractor.extract(event);
}