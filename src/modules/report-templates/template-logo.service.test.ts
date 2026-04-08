// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSharp = vi.fn();
const mockResize = vi.fn();
const mockPng = vi.fn();
const mockToBuffer = vi.fn();

vi.mock('sharp', () => ({
  default: (...args: unknown[]) => {
    mockSharp(...args);
    return { resize: mockResize };
  },
}));

const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();
const mockRename = vi.fn();
const mockUnlink = vi.fn();
const mockReadFile = vi.fn();

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockExistsSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

vi.mock('@/lib/config/env', () => ({
  env: { REPORT_STORAGE_PATH: '/tmp/test-reports' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  init: () => () => 'testuploadid1234',
}));

describe('template-logo.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResize.mockReturnValue({ png: mockPng });
    mockPng.mockReturnValue({ toBuffer: mockToBuffer });
    mockToBuffer.mockResolvedValue(Buffer.from('resized-png'));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  describe('uploadLogoToStaging', () => {
    it('accepts a valid PNG and returns uploadId', async () => {
      const { uploadLogoToStaging } = await import('./template-logo.service');

      const result = await uploadLogoToStaging('ws_1', Buffer.from('fakepng'), 'image/png');

      expect(result.uploadId).toBe('testuploadid1234');
      expect(mockSharp).toHaveBeenCalled();
      expect(mockResize).toHaveBeenCalledWith(400, 200, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('staging/testuploadid1234.png'),
        expect.any(Buffer)
      );
    });

    it('accepts JPEG', async () => {
      const { uploadLogoToStaging } = await import('./template-logo.service');

      const result = await uploadLogoToStaging('ws_1', Buffer.from('fakejpg'), 'image/jpeg');
      expect(result.uploadId).toBeDefined();
    });

    it('accepts SVG', async () => {
      const { uploadLogoToStaging } = await import('./template-logo.service');

      const result = await uploadLogoToStaging('ws_1', Buffer.from('<svg></svg>'), 'image/svg+xml');
      expect(result.uploadId).toBeDefined();
    });

    it('rejects invalid MIME type', async () => {
      const { uploadLogoToStaging, LogoValidationError } = await import('./template-logo.service');

      await expect(
        uploadLogoToStaging('ws_1', Buffer.from('data'), 'application/pdf')
      ).rejects.toThrow(LogoValidationError);
    });

    it('rejects files exceeding 2MB', async () => {
      const { uploadLogoToStaging, LogoValidationError } = await import('./template-logo.service');

      const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 1);

      await expect(uploadLogoToStaging('ws_1', largeBuffer, 'image/png')).rejects.toThrow(
        LogoValidationError
      );
    });
  });

  describe('commitStagingLogo', () => {
    it('moves file from staging to final path', async () => {
      mockExistsSync.mockReturnValue(true);

      const { commitStagingLogo } = await import('./template-logo.service');

      const result = await commitStagingLogo('ws_1', 'testuploadid1234', 'tmpl_abc');

      expect(result).toBe('logos/ws_1/tmpl_abc.png');
      expect(mockRename).toHaveBeenCalledWith(
        expect.stringContaining('staging/testuploadid1234.png'),
        expect.stringContaining('ws_1/tmpl_abc.png')
      );
    });

    it('throws when staging file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const { commitStagingLogo, LogoValidationError } = await import('./template-logo.service');

      await expect(commitStagingLogo('ws_1', 'expired_id', 'tmpl_abc')).rejects.toThrow(
        LogoValidationError
      );
    });
  });

  describe('deleteLogo', () => {
    it('deletes existing file', async () => {
      mockExistsSync.mockReturnValue(true);

      const { deleteLogo } = await import('./template-logo.service');
      await deleteLogo('logos/ws_1/tmpl_abc.png');

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('logos/ws_1/tmpl_abc.png'));
    });

    it('silently skips when file missing', async () => {
      mockExistsSync.mockReturnValue(false);

      const { deleteLogo } = await import('./template-logo.service');
      await deleteLogo('logos/ws_1/missing.png');

      expect(mockUnlink).not.toHaveBeenCalled();
    });
  });

  describe('resolveLogoBuffer', () => {
    it('returns buffer when file exists', async () => {
      const logoBuffer = Buffer.from('logo-data');
      mockReadFile.mockResolvedValue(logoBuffer);

      const { resolveLogoBuffer } = await import('./template-logo.service');
      const result = await resolveLogoBuffer('logos/ws_1/tmpl_abc.png');

      expect(result).toEqual(logoBuffer);
    });

    it('returns undefined when file missing', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const { resolveLogoBuffer } = await import('./template-logo.service');
      const result = await resolveLogoBuffer('logos/ws_1/missing.png');

      expect(result).toBeUndefined();
    });
  });
});
