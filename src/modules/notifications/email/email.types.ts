export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  permanent?: boolean;
}
