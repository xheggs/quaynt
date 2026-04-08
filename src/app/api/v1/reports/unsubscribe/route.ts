import { NextRequest, NextResponse } from 'next/server';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { unsubscribeRecipient } from '@/modules/scheduled-reports/scheduled-report.service';

function htmlResponse(title: string, message: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const GET = withRequestId(
  withRequestLog(async (req: NextRequest) => {
    const recipientId = req.nextUrl.searchParams.get('recipientId');
    const token = req.nextUrl.searchParams.get('token');

    if (!recipientId || !token) {
      return htmlResponse('Invalid Link', 'This unsubscribe link is invalid or has expired.');
    }

    const result = await unsubscribeRecipient(recipientId, token);

    switch (result) {
      case 'success':
        return htmlResponse(
          'Unsubscribed',
          'You have been unsubscribed from this scheduled report.'
        );
      case 'already_unsubscribed':
        return htmlResponse(
          'Already Unsubscribed',
          'You are already unsubscribed from this report.'
        );
      case 'invalid_token':
        return htmlResponse('Invalid Link', 'This unsubscribe link is invalid or has expired.');
    }
  })
);
