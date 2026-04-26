import axios from 'axios';

/** Sparrow v2 expects 10-digit Nepal mobile (9XXXXXXXXX). Strip +977 / 977 prefix if present. */
function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('977') && digits.length === 13) return digits.slice(3);
  return digits;
}

export async function sendSMS(phone: string, message: string): Promise<void> {
  // Dry-run escape hatch for local testing without burning SMS credits.
  if (process.env.SMS_DRY_RUN === '1') {
    console.log(`[SMS DRY-RUN] To: ${phone} | Message: ${message}`);
    return;
  }

  if (!process.env.SPARROW_SMS_TOKEN || !process.env.SPARROW_SMS_FROM) {
    throw new Error('Sparrow SMS credentials not configured');
  }

  const to = normalize(phone);

  const { data } = await axios.post(
    'https://apisms.sparrowsms.com/v2/sms/',
    {
      token: process.env.SPARROW_SMS_TOKEN,
      from:  process.env.SPARROW_SMS_FROM,
      to,
      text:  message,
    },
    { timeout: 10_000 },
  );

  // Sparrow returns HTTP 200 even on business-logic failures — check response_code.
  if (data?.response_code !== 200) {
    throw new Error(`Sparrow rejected SMS: code=${data?.response_code} msg=${data?.response}`);
  }
}

export const otpMessage = (otp: string) =>
  `Your DISTRO verification code is ${otp}. Valid for 10 minutes. Do not share.`;
