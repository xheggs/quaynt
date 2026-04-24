// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  TemplateLayout,
  TemplateBranding,
  CreateTemplateInput,
} from './report-template.types';

// --- Mock DB ---

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

function createChainedQuery(finalResult: unknown) {
  mockReturning.mockResolvedValue(finalResult);
  mockLimit.mockResolvedValue(finalResult);
  mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSet.mockReturnValue({ where: mockWhere });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockSelect.mockReturnValue({ from: mockFrom });
  mockInsert.mockReturnValue({ values: mockValues });
  mockUpdate.mockReturnValue({ set: mockSet });
}

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/config/env', () => ({
  env: { REPORT_STORAGE_PATH: '/tmp/test-reports' },
}));

vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/db/id', () => ({
  generatePrefixedId: vi.fn().mockReturnValue('tmpl_dupcopy123456'),
}));

const sampleLayout: TemplateLayout = {
  sections: [
    { id: 'cover', visible: true },
    { id: 'executiveSummary', visible: true },
    { id: 'recommendationShare', visible: true },
  ],
};

const sampleBranding: TemplateBranding = {
  primaryColor: '#112233',
  secondaryColor: '#445566',
};

const sampleTemplate = {
  id: 'tmpl_abc123',
  workspaceId: 'ws_1',
  createdBy: 'usr_1',
  name: 'My Template',
  description: 'Test template',
  layout: sampleLayout,
  branding: sampleBranding,
  coverOverrides: null,
  deletedAt: null,
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};

describe('report-template.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('creates a template when under limit', async () => {
      // First call: count query returns 0
      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 0 }]),
        }),
      };
      mockSelect.mockReturnValueOnce(countChain);

      // Second call: insert returns created template
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([sampleTemplate]),
        }),
      });

      const { createTemplate } = await import('./report-template.service');

      const input: CreateTemplateInput = {
        name: 'My Template',
        layout: sampleLayout,
      };

      const result = await createTemplate('ws_1', 'usr_1', input);
      expect(result.id).toBe('tmpl_abc123');
      expect(result.name).toBe('My Template');
    });

    it('throws TemplateLimitError when at limit', async () => {
      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 25 }]),
        }),
      };
      mockSelect.mockReturnValueOnce(countChain);

      const { createTemplate, TemplateLimitError } = await import('./report-template.service');

      const input: CreateTemplateInput = {
        name: 'Overflow',
        layout: sampleLayout,
      };

      await expect(createTemplate('ws_1', 'usr_1', input)).rejects.toThrow(TemplateLimitError);
    });
  });

  describe('getTemplate', () => {
    it('returns template with backfilled sections', async () => {
      createChainedQuery([sampleTemplate]);

      const { getTemplate } = await import('./report-template.service');

      const result = await getTemplate('ws_1', 'tmpl_abc123');
      expect(result).not.toBeNull();

      // Original layout had 3 sections; REPORT_SECTIONS has 10.
      // Backfill should add the 7 missing sections with visible: false.
      expect(result!.layout.sections.length).toBe(10);

      const missingSection = result!.layout.sections.find((s) => s.id === 'opportunities');
      expect(missingSection).toBeDefined();
      expect(missingSection!.visible).toBe(false);
    });

    it('returns null when template not found', async () => {
      createChainedQuery([]);

      const { getTemplate } = await import('./report-template.service');

      const result = await getTemplate('ws_1', 'tmpl_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('returns summary list', async () => {
      const summaries = [
        {
          id: 'tmpl_1',
          name: 'T1',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tmpl_2',
          name: 'T2',
          description: 'Desc',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(summaries),
        }),
      });

      const { listTemplates } = await import('./report-template.service');

      const result = await listTemplates('ws_1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('T1');
    });
  });

  describe('deleteTemplate', () => {
    it('soft-deletes a template', async () => {
      createChainedQuery([{ id: 'tmpl_abc123' }]);

      const { deleteTemplate } = await import('./report-template.service');

      const result = await deleteTemplate('ws_1', 'tmpl_abc123');
      expect(result).toBe(true);
    });

    it('returns false when template not found', async () => {
      createChainedQuery([]);

      const { deleteTemplate } = await import('./report-template.service');

      const result = await deleteTemplate('ws_1', 'tmpl_nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('duplicateTemplate', () => {
    it('creates a copy with (copy) suffix', async () => {
      // Mock getTemplate (select)
      createChainedQuery([sampleTemplate]);

      const duplicated = {
        ...sampleTemplate,
        id: 'tmpl_dupcopy123456',
        name: 'My Template (copy)',
      };

      // We need to mock the count query and insert for duplicate
      // This is tricky with chained mocks, so we reset and use ordered mocks
      mockSelect
        // First call: getTemplate query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([sampleTemplate]),
            }),
          }),
        })
        // Second call: count query for limit check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ value: 5 }]),
          }),
        });

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([duplicated]),
        }),
      });

      const { duplicateTemplate } = await import('./report-template.service');

      const result = await duplicateTemplate('ws_1', 'tmpl_abc123', 'usr_1');
      expect(result.name).toBe('My Template (copy)');
    });

    it('throws TemplateNotFoundError when source not found', async () => {
      createChainedQuery([]);

      const { duplicateTemplate, TemplateNotFoundError } =
        await import('./report-template.service');

      await expect(duplicateTemplate('ws_1', 'tmpl_nope', 'usr_1')).rejects.toThrow(
        TemplateNotFoundError
      );
    });
  });
});
