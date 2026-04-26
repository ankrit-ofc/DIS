import { Resend } from 'resend';
import { render } from '@react-email/render';
import { prisma } from './prisma';

export { render };

const resend = new Resend(process.env.RESEND_API_KEY || 're_dev_placeholder');

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailResult {
  ok: boolean;
  error?: string;
}

async function safeLog(
  to: string,
  subject: string,
  type: string,
  status: string,
  messageId?: string | null,
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: { to, subject, type, status, ...(messageId ? { messageId } : {}) },
    });
  } catch (err) {
    // Don't let DB log failures crash the caller.
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[Email] emailLog write failed: ${m}`);
  }
}

/**
 * Send a transactional email via Resend. Never throws — returns { ok, error? }.
 * Respects EMAIL_ENABLED=false (skip without calling Resend).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: string,
  attachments?: EmailAttachment[]
): Promise<EmailResult> {
  if (process.env.EMAIL_ENABLED === 'false') {
    console.log(`[Email] Disabled — would send to ${to} (${type}): ${subject}`);
    await safeLog(to, subject, type, 'disabled');
    return { ok: false, error: 'Email disabled' };
  }

  try {
    const testTo = process.env.RESEND_TEST_TO?.trim();
    // With RESEND_TEST_TO set, send via Resend even in development (all mail → one inbox).
    const sendViaResend = Boolean(testTo) || process.env.NODE_ENV === 'production';

    if (!sendViaResend) {
      console.log(`[EMAIL DEV] To: ${to} | Type: ${type} | Subject: ${subject}`);
      await safeLog(to, subject, type, 'dev_log');
      return { ok: true };
    }

    const recipient = testTo || to;
    if (testTo && testTo !== to) {
      console.log(`[EMAIL TEST] ${type}: intended ${to} → ${recipient}`);
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey || apiKey === 're_dev_placeholder') {
      const err = 'RESEND_API_KEY not set';
      console.error(`[Email] Failed for ${recipient}: ${err}`);
      await safeLog(recipient, subject, type, 'failed');
      return { ok: false, error: err };
    }

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM || 'DISTRO Nepal <no-reply@distronepal.com>',
      to: recipient,
      subject,
      html,
      ...(attachments && attachments.length > 0
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
            })),
          }
        : {}),
    });

    if (result.error) {
      const err = `${result.error.name}: ${result.error.message}${
        result.error.statusCode != null ? ` (HTTP ${result.error.statusCode})` : ''
      }`;
      console.error(`[Email] Failed for ${recipient}: ${err}`);
      await safeLog(recipient, subject, type, 'failed');
      return { ok: false, error: err };
    }

    const messageId = result.data?.id ?? null;
    console.log('[Email] Sent', type, '→', recipient, messageId ? `(id ${messageId})` : '');
    await safeLog(recipient, subject, type, 'sent', messageId);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Failed for ${to}: ${message}`);
    await safeLog(to, subject, type, 'failed');
    return { ok: false, error: message };
  }
}
