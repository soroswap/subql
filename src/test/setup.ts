// Global test setup for Jest
import 'jest';

// Extend global types (logger and store are already declared by SubQL)
declare global {
  var createMockDate: (timestamp?: number) => Date;
  var createMockBigInt: (value: number | string) => bigint;
}

// Mock global logger (override the existing one for tests)
(global as any).logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock global store (SubQL entity store)
(global as any).store = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  getByField: jest.fn(),
  getByFields: jest.fn()
};

// Mock console methods to avoid noise in tests
(global as any).console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Setup global test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset logger mocks
  (global as any).logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  
  // Reset store mocks
  (global as any).store = {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    getByField: jest.fn(),
    getByFields: jest.fn()
  };
});

// Global test utilities
(global as any).createMockDate = (timestamp?: number) => {
  return new Date(timestamp || Date.now());
};

(global as any).createMockBigInt = (value: number | string) => {
  return BigInt(value);
};

// Export test utilities for use in test files
export const testUtils = {
  createMockDate: (global as any).createMockDate,
  createMockBigInt: (global as any).createMockBigInt
};