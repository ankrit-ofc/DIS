import { Resend } from 'resend';
import { render } from '@react-email/render';
import { prisma } from './prisma';

export { render };

const resend = new Resend(process.env.RESEND_API_KEY || 're_dev_placeholder');

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: string,
  attachments?: EmailAttachment[]
): Promise<void> {
  const testTo = process.env.RESEND_TEST_TO?.trim();
  // With RESEND_TEST_TO set, send via Resend even in development (all mail → one inbox).
  const sendViaResend = Boolean(testTo) || process.env.NODE_ENV === 'production';

  if (!sendViaResend) {
    console.log(`[EMAIL DEV] To: ${to} | Type: ${type} | Subject: ${subject}`);
    await prisma.emailLog.create({ data: { to, subject, type, status: 'dev_log' } });
    return;
  }

  const recipient = testTo || to;
  if (testTo && testTo !== to) {
    console.log(`[EMAIL TEST] ${type}: intended ${to} → ${recipient}`);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === 're_dev_placeholder') {
    console.error('[EMAIL ERROR] Set RESEND_API_KEY in .env (Resend dashboard → API Keys)');
    await prisma.emailLog.create({
      data: { to: recipient, subject, type, status: 'failed' },
    });
    return;
  }

  try {
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
      console.error(
        '[EMAIL ERROR]',
        result.error.name,
        result.error.message,
        result.error.statusCode != null ? `(HTTP ${result.error.statusCode})` : '',
      );
      await prisma.emailLog.create({
        data: { to: recipient, subject, type, status: 'failed' },
      });
      return;
    }

    const messageId = result.data?.id ?? null;
    console.log('[EMAIL SENT]', type, '→', recipient, messageId ? `(id ${messageId})` : '');
    await prisma.emailLog.create({
      data: {
        to: recipient,
        subject,
        type,
        status: 'sent',
        messageId: messageId ?? undefined,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[EMAIL ERROR]', message);
    await prisma.emailLog.create({ data: { to: recipient, subject, type, status: 'failed' } });
  }
}
