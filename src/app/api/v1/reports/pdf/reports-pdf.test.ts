// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockGetAuthContext = vi.fn();
const mockGetRequestLogger = vi.fn();

vi.mock('@/lib/api/middleware', () => ({
  withAuth: (handler: (...args: unknown[]) => unknown) => handler,
  withScope: (handler: (...args: unknown[]) => unknown) => handler,
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@/lib/api/request-id', () => ({
  withRequestId: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@/lib/api/request-log', () => ({
  withRequestLog: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@/lib/logger', () => ({
  getRequestLogger: (...args: unknown[]) => mockGetRequestLogger(...args),
  logger: { child: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

const mockDbInsert = vi.fn();
const mockDbValues = vi.fn();
const mockDbReturning = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbLimit = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return { values: mockDbValues };
    },
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return { from: mockDbFrom };
    },
  },
}));

mockDbValues.mockReturnValue({ returning: mockDbReturning });
mockDbReturning.mockResolvedValue([{ id: 'rpt_new123' }]);
mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ limit: mockDbLimit });
mockDbLimit.mockResolvedValue([]);

const mockBossSend = vi.fn();
vi.mock('@/lib/jobs/boss', () => ({
  createBoss: () => ({ send: mockBossSend }),
}));

const mockGetWorkspaceById = vi.fn();
vi.mock('@/modules/workspace/workspace.service', () => ({
  getWorkspaceById: (...args: unknown[]) => mockGetWorkspaceById(...args),
}));

vi.mock('@/modules/pdf/report-job.schema', () => ({
  reportJob: {
    id: 'id',
    workspaceId: 'workspaceId',
    status: 'status',
    scope: 'scope',
  },
}));

vi.mock('@/modules/pdf/pdf.types', () => ({
  pdfReportRequestSchema: {
    safeParse: vi.fn((data: unknown) => {
      if (typeof data === 'object' && data !== null && 'promptSetId' in data) {
        return { success: true, data: { ...data, locale: (data as any).locale ?? 'en' } };
      }
      return {
        success: false,
        error: { issues: [{ path: ['promptSetId'], message: 'Required' }] },
      };
    }),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('%PDF-1.4 test content')),
}));

// --- Helpers ---

function makeRequest(body: object): any {
  return {
    json: () => Promise.resolve(body),
    nextUrl: new URL('http://localhost:3000/api/v1/reports/pdf'),
  };
}

function makeGetRequest(searchParams?: Record<string, string>): any {
  const url = new URL('http://localhost:3000/api/v1/reports/pdf/rpt_123');
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return { nextUrl: url };
}

describe('POST /api/v1/reports/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      method: 'session',
      userId: 'usr_1',
      workspaceId: 'ws_1',
      scopes: ['read'],
    });
    mockGetRequestLogger.mockReturnValue({ info: vi.fn(), error: vi.fn() });
    mockGetWorkspaceById.mockResolvedValue({ id: 'ws_1', name: 'Test Workspace' });
    mockDbValues.mockReturnValue({ returning: mockDbReturning });
    mockDbReturning.mockResolvedValue([{ id: 'rpt_new123' }]);
    mockBossSend.mockResolvedValue('job-id');
  });

  it('creates job and returns 201', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        promptSetId: 'ps_1',
        brandIds: 'brand_1,brand_2',
      }),
      {} as any
    );

    const json = await response.json();
    expect(response.status).toBe(201);
    expect(json.data.jobId).toBe('rpt_new123');
    expect(json.data.status).toBe('pending');
  });

  it('enqueues pg-boss job with correct data', async () => {
    const { POST } = await import('./route');

    await POST(
      makeRequest({
        promptSetId: 'ps_1',
        brandIds: 'brand_1',
      }),
      {} as any
    );

    expect(mockBossSend).toHaveBeenCalledWith(
      'report-pdf-generate',
      expect.objectContaining({
        jobId: 'rpt_new123',
        workspaceId: 'ws_1',
        workspaceName: 'Test Workspace',
      }),
      expect.objectContaining({
        retryLimit: 3,
        expireInSeconds: 60,
      })
    );
  });

  it('returns 400 for missing promptSetId', async () => {
    const { POST } = await import('./route');

    const response = await POST(makeRequest({}), {} as any);

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing brand IDs', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        promptSetId: 'ps_1',
      }),
      {} as any
    );

    expect(response.status).toBe(400);
  });

  it('uses apiKeyId as createdBy for API key auth', async () => {
    const { POST } = await import('./route');

    mockGetAuthContext.mockReturnValue({
      method: 'api-key',
      userId: null,
      apiKeyId: 'key_abc',
      workspaceId: 'ws_1',
      scopes: ['read'],
    });

    await POST(
      makeRequest({
        promptSetId: 'ps_1',
        brandIds: 'brand_1',
      }),
      {} as any
    );

    expect(mockDbValues).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'key_abc',
      })
    );
  });
});

describe('GET /api/v1/reports/pdf/:jobId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      method: 'session',
      userId: 'usr_1',
      workspaceId: 'ws_1',
      scopes: ['read'],
    });
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ limit: mockDbLimit });
  });

  it('returns job status for pending job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'pending',
        createdAt: new Date('2026-04-01'),
        startedAt: null,
        expiresAt: new Date('2099-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.status).toBe('pending');
  });

  it('returns downloadUrl for completed job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'completed',
        fileSizeBytes: 50000,
        pageCount: 5,
        completedAt: new Date('2026-04-01T12:00:00Z'),
        expiresAt: new Date('2099-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    const json = await response.json();
    expect(json.data.downloadUrl).toBe('/api/v1/reports/pdf/rpt_123/download');
    expect(json.data.fileSizeBytes).toBe(50000);
  });

  it('returns 404 for unknown job', async () => {
    mockDbLimit.mockResolvedValue([]);

    const { GET } = await import('./[jobId]/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_nonexistent' }),
    } as any);

    expect(response.status).toBe(404);
  });

  it('returns 410 for expired job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'expired',
        expiresAt: new Date('2026-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    expect(response.status).toBe(410);
  });

  it('returns error for failed job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'failed',
        errorMessage: 'Generation timed out',
        expiresAt: new Date('2099-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    const json = await response.json();
    expect(json.data.status).toBe('failed');
    expect(json.data.error).toBe('Generation timed out');
  });
});

describe('GET /api/v1/reports/pdf/:jobId/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      method: 'session',
      userId: 'usr_1',
      workspaceId: 'ws_1',
      scopes: ['read'],
    });
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ limit: mockDbLimit });
  });

  it('returns PDF file for completed job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'completed',
        filePath: '/tmp/reports/rpt_123.pdf',
        expiresAt: new Date('2099-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/download/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('report_rpt_123.pdf');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 409 for non-completed job', async () => {
    mockDbLimit.mockResolvedValue([
      {
        id: 'rpt_123',
        status: 'processing',
        expiresAt: new Date('2099-01-01'),
      },
    ]);

    const { GET } = await import('./[jobId]/download/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_123' }),
    } as any);

    expect(response.status).toBe(409);
  });

  it('returns 404 for unknown job', async () => {
    mockDbLimit.mockResolvedValue([]);

    const { GET } = await import('./[jobId]/download/route');

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ jobId: 'rpt_none' }),
    } as any);

    expect(response.status).toBe(404);
  });
});
