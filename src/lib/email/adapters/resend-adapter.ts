import { Resend } from 'resend';

import type { EmailService, SendEmailParams, SendEmailResult } from '../types';

export class ResendEmailAdapter implements EmailService {
  private client: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.client = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('[email] Sending via Resend:', { to: params.to, subject: params.subject });

    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (error) {
        console.error('[email] Resend error:', error);
        return { success: false, error: error.message };
      }

      console.log('[email] Sent successfully:', { to: params.to, messageId: data?.id });
      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('[email] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
