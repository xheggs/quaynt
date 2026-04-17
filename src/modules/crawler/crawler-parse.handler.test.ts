// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PgBoss } from 'pg-boss';

const mockBatchInsertVisits = vi.fn();
const mockGetAffectedDates = vi.fn();
const mockBatchInsertAiVisits = vi.fn();
const mockGetUpload = vi.fn();
const mockUpdateUploadStatus = vi.fn();
const mockDeleteStagingFile = vi.fn();
const mockGetStagingPath = vi.fn();
const mockBossWork = vi.fn();
const mockBossSend = vi.fn();

vi.mock('./crawler-visit.service', () => ({
  batchInsertVisits: (...args: unknown[]) => mockBatchInsertVisits(...args),
  getAffectedDates: (...args: unknown[]) => mockGetAffectedDates(...args),
}));

vi.mock('@/modules/traffic/ai-visit.service', () => ({
  batchInsertVisits: (...args: unknown[]) => mockBatchInsertAiVisits(...args),
}));

vi.mock('./crawler-upload.service', () => ({
  getUpload: (...args: unknown[]) => mockGetUpload(...args),
  updateUploadStatus: (...args: unknown[]) => mockUpdateUploadStatus(...args),
  deleteStagingFile: (...args: unknown[]) => mockDeleteStagingFile(...args),
  getStagingPath: (...args: unknown[]) => mockGetStagingPath(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

function createMockBoss() {
  return {
    work: mockBossWork,
    send: mockBossSend,
  };
}

describe('crawler-parse.handler', () => {
  let tempDir: string;
  let fixturePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'crawler-parse-test-'));
    fixturePath = join(tempDir, 'access.log');

    mockBossWork.mockResolvedValue(undefined);
    mockBossSend.mockResolvedValue(undefined);
    mockBatchInsertVisits.mockResolvedValue(0);
    mockBatchInsertAiVisits.mockResolvedValue(0);
    mockGetAffectedDates.mockResolvedValue(['2025-10-10']);
    mockUpdateUploadStatus.mockResolvedValue(undefined);
    mockDeleteStagingFile.mockResolvedValue(undefined);
    mockGetStagingPath.mockReturnValue(fixturePath);
    mockGetUpload.mockResolvedValue({
      id: 'upload_1',
      filename: 'access.log',
      status: 'processing',
    });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function runParse(): Promise<void> {
    const boss = createMockBoss();
    const { registerCrawlerParseHandler } = await import('./crawler-parse.handler');
    await registerCrawlerParseHandler(boss as unknown as PgBoss);
    const handler = mockBossWork.mock.calls[0][2] as (
      jobs: Array<{ id: string; data: { workspaceId: string; uploadId: string } }>
    ) => Promise<void>;
    await handler([{ id: 'job_1', data: { workspaceId: 'ws_test', uploadId: 'upload_1' } }]);
  }

  it('produces AI visit rows for ChatGPT-referred human visits and crawler rows for bots', async () => {
    const lines = [
      // 3 GPTBot lines (bot) — two on 2025-10-10, one on 2025-10-11
      '1.1.1.1 - - [10/Oct/2025:13:55:36 -0700] "GET /a HTTP/1.1" 200 1 "-" "GPTBot/1.0"',
      '1.1.1.2 - - [10/Oct/2025:13:55:37 -0700] "GET /b HTTP/1.1" 200 2 "-" "GPTBot/1.0"',
      '1.1.1.3 - - [11/Oct/2025:13:55:38 -0700] "GET /c HTTP/1.1" 200 3 "-" "GPTBot/1.0"',
      // 3 ChatGPT-referred human lines — all on 2025-10-10
      '2.2.2.1 - - [10/Oct/2025:14:00:00 -0700] "GET /blog/x HTTP/1.1" 200 10 "https://chatgpt.com/c/abc" "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0"',
      '2.2.2.2 - - [10/Oct/2025:14:00:01 -0700] "GET /blog/y HTTP/1.1" 200 20 "https://chatgpt.com/c/def" "Mozilla/5.0 Firefox/118.0"',
      '2.2.2.3 - - [10/Oct/2025:14:00:02 -0700] "GET /pricing HTTP/1.1" 200 30 "https://www.perplexity.ai/search" "Mozilla/5.0 Safari/16.0"',
      // 3 non-AI human lines (should be dropped)
      '3.3.3.1 - - [10/Oct/2025:14:01:00 -0700] "GET / HTTP/1.1" 200 40 "https://google.com/" "Mozilla/5.0 Chrome/120.0"',
      '3.3.3.2 - - [10/Oct/2025:14:01:01 -0700] "GET / HTTP/1.1" 200 50 "-" "Mozilla/5.0 Chrome/120.0"',
      '3.3.3.3 - - [10/Oct/2025:14:01:02 -0700] "GET / HTTP/1.1" 200 60 "https://news.ycombinator.com/" "Mozilla/5.0 Chrome/120.0"',
      // 2 malformed lines
      'this is not a log line',
      '',
    ];
    writeFileSync(fixturePath, lines.join('\n') + '\n', 'utf8');

    await runParse();

    // Crawler batch insert should contain 3 bot rows
    expect(mockBatchInsertVisits).toHaveBeenCalledTimes(1);
    const crawlerRows = mockBatchInsertVisits.mock.calls[0][0] as Array<{
      botName: string;
      requestPath: string;
    }>;
    expect(crawlerRows).toHaveLength(3);
    expect(crawlerRows.every((r) => r.botName === 'GPTBot')).toBe(true);

    // AI visit batch insert should contain exactly 3 AI-referred human rows
    expect(mockBatchInsertAiVisits).toHaveBeenCalledTimes(1);
    const aiRows = mockBatchInsertAiVisits.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(aiRows).toHaveLength(3);

    const chatgptRows = aiRows.filter((r) => r.platform === 'chatgpt');
    expect(chatgptRows).toHaveLength(2);
    const perplexityRows = aiRows.filter((r) => r.platform === 'perplexity');
    expect(perplexityRows).toHaveLength(1);

    // PII discipline: every AI row has source='log', siteKeyId=null, referrer as hostname only, no IP
    for (const row of aiRows) {
      expect(row.source).toBe('log');
      expect(row.siteKeyId).toBeNull();
      expect(row.workspaceId).toBe('ws_test');
      expect(row.visitedAt).toBeInstanceOf(Date);
      // referrerHost is lowercase hostname, no path, no query, no protocol
      expect(row.referrerHost).toMatch(/^[a-z0-9.-]+$/);
      expect(String(row.referrerHost)).not.toContain('/');
      expect(String(row.referrerHost)).not.toContain('https:');
      // No raw UA or IP leak
      expect(row).not.toHaveProperty('userAgent');
      expect(row).not.toHaveProperty('ip');
      expect(row).not.toHaveProperty('referer');
      expect(row).not.toHaveProperty('sessionHash');
      // Coarse UA family only
      expect(['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Other']).toContain(
        row.userAgentFamily
      );
    }

    // Crawler aggregate fan-out (from mocked getAffectedDates)
    expect(mockBossSend).toHaveBeenCalledWith(
      'crawler-aggregate',
      { workspaceId: 'ws_test', date: '2025-10-10' },
      expect.objectContaining({
        singletonKey: 'crawler-agg:ws_test:2025-10-10',
        singletonSeconds: 120,
      })
    );

    // Traffic aggregate fan-out — only 2025-10-10 had AI visits
    const trafficCalls = mockBossSend.mock.calls.filter((c) => c[0] === 'traffic-aggregate');
    expect(trafficCalls).toHaveLength(1);
    expect(trafficCalls[0][1]).toEqual({ workspaceId: 'ws_test', date: '2025-10-10' });
    expect(trafficCalls[0][2]).toMatchObject({
      singletonKey: 'traffic-agg:ws_test:2025-10-10',
      singletonSeconds: 120,
    });

    // Completion status
    expect(mockUpdateUploadStatus).toHaveBeenCalledWith(
      'upload_1',
      'completed',
      expect.objectContaining({
        linesParsed: 6, // 3 bots + 3 AI visits
      })
    );
  });

  it('does not emit ai_visit rows or traffic-aggregate jobs when no AI referrers are present', async () => {
    writeFileSync(
      fixturePath,
      [
        '1.1.1.1 - - [10/Oct/2025:13:55:36 -0700] "GET /a HTTP/1.1" 200 1 "-" "GPTBot/1.0"',
        '1.1.1.2 - - [10/Oct/2025:13:55:37 -0700] "GET /b HTTP/1.1" 200 2 "-" "ClaudeBot/1.0"',
      ].join('\n') + '\n',
      'utf8'
    );

    await runParse();

    expect(mockBatchInsertVisits).toHaveBeenCalledTimes(1);
    expect(mockBatchInsertAiVisits).not.toHaveBeenCalled();
    const trafficCalls = mockBossSend.mock.calls.filter((c) => c[0] === 'traffic-aggregate');
    expect(trafficCalls).toHaveLength(0);
  });
});
