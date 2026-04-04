// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pino', () => {
  const mockChild = vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: mockChild,
  };
  return { default: vi.fn(() => mockLogger) };
});

import { logger, setRequestLogger, getRequestLogger } from './index';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('creates child loggers', () => {
    const child = logger.child({ requestId: 'req_123' });
    expect(logger.child).toHaveBeenCalledWith({ requestId: 'req_123' });
    expect(child).toBeDefined();
  });

  describe('request logger WeakMap', () => {
    it('returns singleton logger when no request logger is set', () => {
      const req = new Request('http://localhost/test');
      expect(getRequestLogger(req)).toBe(logger);
    });

    it('stores and retrieves request-scoped logger', () => {
      const req = new Request('http://localhost/test');
      const child = logger.child({ requestId: 'req_456' });

      setRequestLogger(req, child);
      expect(getRequestLogger(req)).toBe(child);
    });

    it('does not leak between requests', () => {
      const req1 = new Request('http://localhost/test1');
      const req2 = new Request('http://localhost/test2');
      const child = logger.child({ requestId: 'req_789' });

      setRequestLogger(req1, child);
      expect(getRequestLogger(req1)).toBe(child);
      expect(getRequestLogger(req2)).toBe(logger);
    });
  });
});
