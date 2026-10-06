import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_MAIL_DIR = path.resolve(__dirname, '../../backend/target/dev-mail');

export interface ParsedDevEmail {
  filename: string;
  type: string;
  to: string;
  subject: string;
  activationUrl?: string;
  inviteToken?: string;
  otp?: string;
}

function parseMailFile(filePath: string): ParsedDevEmail | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const typeMatch = content.match(/^Type:\s*(.+)$/m);
    const toMatch = content.match(/^To:\s*(.+)$/m);
    const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
    const activationUrlMatch = content.match(/^Activation-URL:\s*(.+)$/m);
    const otpMatch = content.match(/^OTP:\s*(.+)$/m);

    if (!typeMatch || !toMatch) return null;

    const activationUrl = activationUrlMatch?.[1]?.trim();
    let inviteToken: string | undefined;
    if (activationUrl) {
      const tokenMatch = activationUrl.match(/[?&]token=([^&\s]+)/);
      inviteToken = tokenMatch?.[1];
    }

    return {
      filename: path.basename(filePath),
      type: typeMatch[1]!.trim(),
      to: toMatch[1]!.trim().toLowerCase(),
      subject: subjectMatch?.[1]?.trim() ?? '',
      ...(activationUrl ? { activationUrl } : {}),
      ...(inviteToken ? { inviteToken } : {}),
      ...(otpMatch?.[1]?.trim() ? { otp: otpMatch[1].trim() } : {})
    };
  } catch {
    return null;
  }
}

export async function waitForDevEmail(
  toEmail: string,
  type: 'invite' | 'activation-otp' | 'password-reset-otp',
  timeoutMs = 10_000
): Promise<ParsedDevEmail> {
  const targetEmail = toEmail.trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (fs.existsSync(DEV_MAIL_DIR)) {
      const files = fs
        .readdirSync(DEV_MAIL_DIR)
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .reverse();

      for (const file of files) {
        const parsed = parseMailFile(path.join(DEV_MAIL_DIR, file));
        if (parsed && parsed.to === targetEmail && parsed.type === type) {
          return parsed;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  throw new Error(`Timed out waiting for dev-mail of type "${type}" to "${toEmail}" in ${DEV_MAIL_DIR}`);
}
