import type { EmailService } from './types';
import { ResendEmailAdapter } from './adapters/resend-adapter';

let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    // Current provider: Resend
    // To swap providers, replace this with a different adapter:
    //   emailService = new SendGridAdapter(process.env.SENDGRID_API_KEY!, ...);
    emailService = new ResendEmailAdapter(
      process.env.RESEND_API_KEY!,
      process.env.FROM_EMAIL!,
    );
  }
  return emailService;
}

// Re-export types for convenience
export type { EmailService, SendEmailParams, SendEmailResult } from './types';
