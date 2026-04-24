import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, apiNoContent, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getUpload, cancelUpload, deleteUpload } from '@/modules/crawler/crawler-upload.service';

// GET /api/v1/crawler/uploads/[uploadId] — upload detail
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const upload = await getUpload(auth.workspaceId, uploadId);
          if (!upload) return notFound(t('resources.upload'));

          return apiSuccess(upload);
        }, 'read')
      )
    )
  )
);

// POST /api/v1/crawler/uploads/[uploadId] — cancel upload
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const cancelled = await cancelUpload(auth.workspaceId, uploadId);
          if (!cancelled) {
            return badRequest(t('uploads.cannotCancel'));
          }

          return apiSuccess({ uploadId, status: 'cancelled' });
        }, 'read-write')
      )
    )
  )
);

// DELETE /api/v1/crawler/uploads/[uploadId] — delete upload
export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const deleted = await deleteUpload(auth.workspaceId, uploadId);
          if (!deleted) return notFound(t('resources.upload'));

          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
