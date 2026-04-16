import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, apiNoContent, badRequest, notFound } from '@/lib/api/response';
import { getUpload, cancelUpload, deleteUpload } from '@/modules/crawler/crawler-upload.service';

// GET /api/v1/crawler/uploads/[uploadId] — upload detail
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const upload = await getUpload(auth.workspaceId, uploadId);
          if (!upload) return notFound('Upload not found');

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
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const cancelled = await cancelUpload(auth.workspaceId, uploadId);
          if (!cancelled) {
            return badRequest('Upload cannot be cancelled (not pending or processing)');
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
          const { uploadId } = await (ctx as { params: Promise<{ uploadId: string }> }).params;

          const deleted = await deleteUpload(auth.workspaceId, uploadId);
          if (!deleted) return notFound('Upload not found');

          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
