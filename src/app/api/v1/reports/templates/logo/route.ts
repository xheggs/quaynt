import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, badRequest, forbidden } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import {
  uploadLogoToStaging,
  LogoValidationError,
} from '@/modules/report-templates/template-logo.service';

// POST /api/v1/reports/templates/logo — upload logo to staging
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const t = await apiErrors();
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden(t('reports.templatesCommercial'));
          }

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);

          // Parse multipart form data
          let formData: FormData;
          try {
            formData = await req.formData();
          } catch {
            return badRequest(t('uploads.logoFileExpected'));
          }

          const file = formData.get('logo');
          if (!file || !(file instanceof File)) {
            return badRequest(t('uploads.logoFileMissing'));
          }

          const fileBuffer = Buffer.from(await file.arrayBuffer());
          const mimeType = file.type;

          try {
            const { uploadId } = await uploadLogoToStaging(auth.workspaceId, fileBuffer, mimeType);

            log.info({ uploadId }, 'Logo uploaded to staging');
            return apiCreated({ uploadId });
          } catch (err) {
            if (err instanceof LogoValidationError) {
              return badRequest(err.message);
            }
            throw err;
          }
        }, 'read-write'),
        { points: 10, duration: 60 }
      )
    )
  )
);
