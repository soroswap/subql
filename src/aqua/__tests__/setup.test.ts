// Simple test to verify Jest setup is working
describe('Jest Setup', () => {
  it('should have global logger available', () => {
    expect((global as any).logger).toBeDefined();
    expect((global as any).logger.info).toBeDefined();
    expect((global as any).logger.error).toBeDefined();
    expect((global as any).logger.warn).toBeDefined();
    expect((global as any).logger.debug).toBeDefined();
  });

  it('should have test utilities available', () => {
    expect(global.createMockDate).toBeDefined();
    expect(global.createMockBigInt).toBeDefined();
  });

  it('should create mock date', () => {
    const mockDate = global.createMockDate();
    expect(mockDate).toBeInstanceOf(Date);
  });

  it('should create mock bigint', () => {
    const mockBigInt = global.createMockBigInt(1000);
    expect(typeof mockBigInt).toBe('bigint');
    expect(mockBigInt).toBe(BigInt(1000));
  });
});