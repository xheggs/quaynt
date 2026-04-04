import { createHmac } from 'node:crypto';
import { env } from '@/lib/config/env';
import { validateWebhookUrl } from './webhook.security';

export interface SignatureHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export function signWebhookPayload(
  deliveryId: string,
  secret: string,
  body: string
): SignatureHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedContent = `${deliveryId}.${timestamp}.${body}`;
  const hmac = createHmac('sha256', secret).update(signedContent).digest('hex');

  return {
    id: deliveryId,
    timestamp,
    signature: `sha256=${hmac}`,
  };
}

export interface DeliveryParams {
  deliveryId: string;
  url: string;
  secret: string;
  payload: { event: string; timestamp: string; data: object };
  timeoutMs?: number;
}

export interface DeliveryResult {
  success: boolean;
  httpStatus: number | null;
  responseBody: string | null;
  latencyMs: number;
  error?: string;
  permanent?: boolean;
}

const MAX_RESPONSE_BODY = 1024;

export async function deliverWebhook(params: DeliveryParams): Promise<DeliveryResult> {
  const { deliveryId, url, secret, payload } = params;
  const timeoutMs = params.timeoutMs ?? env.WEBHOOK_TIMEOUT_MS;

  // SSRF check before delivery
  const urlCheck = await validateWebhookUrl(url);
  if (!urlCheck.valid) {
    return {
      success: false,
      httpStatus: null,
      responseBody: null,
      latencyMs: 0,
      error: urlCheck.reason,
      permanent: true,
    };
  }

  const body = JSON.stringify(payload);
  const headers = signWebhookPayload(deliveryId, secret, body);

  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Quaynt-Webhooks/1.0',
        'X-Quaynt-Id': headers.id,
        'X-Quaynt-Timestamp': headers.timestamp,
        'X-Quaynt-Signature': headers.signature,
      },
      body,
    });

    const latencyMs = Math.round(performance.now() - start);

    let responseBody: string | null = null;
    try {
      const text = await response.text();
      responseBody = text.length > MAX_RESPONSE_BODY ? text.slice(0, MAX_RESPONSE_BODY) : text;
    } catch {
      // Response body not readable
    }

    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      httpStatus: response.status,
      responseBody,
      latencyMs,
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const error = err instanceof Error ? err.message : 'Unknown delivery error';

    return {
      success: false,
      httpStatus: null,
      responseBody: null,
      latencyMs,
      error,
    };
  }
}
