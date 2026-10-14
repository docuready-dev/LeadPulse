import nodemailer, { Transporter } from 'nodemailer';

export interface UserSmtpSettings {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  verifiedAt?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  userSmtp?: UserSmtpSettings;
}

export interface DispatchResult {
  success: boolean;
  messageId: string;
  recipient: string;
  previewUrl: string | null;
  status: 'delivered' | 'failed';
  response: string;
  providerUsed: string;
  error?: string;
}

export interface DeliveredMessageLog {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  timestamp: string;
  status: string;
  provider: string;
  previewUrl?: string | null;
}

// In-memory delivered mail log buffer
export const inAppDeliveredInbox: DeliveredMessageLog[] = [];

/**
 * Verifies standard SMTP connection via real TCP handshake and optional test ping.
 * No mock responses, no dummy relays.
 */
export async function verifyMailboxConnection(
  settings: UserSmtpSettings,
  testRecipient?: string
): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
  const host = (settings.host || '').trim();
  const port = Number(settings.port || 587);
  const user = (settings.user || '').trim();
  const pass = (settings.pass || '').trim();
  const fromName = (settings.fromName || 'LeadPulse Operator').trim();
  const fromEmail = (settings.fromEmail || user).trim();

  if (!host || !port || !user || !pass) {
    return {
      success: false,
      message: 'Missing required SMTP settings: Host, Port, Username, and Password are all required.'
    };
  }

  const isSecure = settings.secure !== undefined
    ? settings.secure
    : (port === 465);

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass
    },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. Authenticate with real SMTP server via socket verify
    await transporter.verify();

    let testMessageId: string | undefined;

    // 2. If testRecipient is provided, send a genuine test email
    if (testRecipient && testRecipient.trim()) {
      const senderDisplay = `"${fromName}" <${fromEmail}>`;
      const replyToAddress = (settings.replyTo || fromEmail).trim();

      const info = await transporter.sendMail({
        from: senderDisplay,
        to: testRecipient.trim(),
        replyTo: replyToAddress,
        subject: 'LeadPulse Outbox Verification: SMTP Connection Verified',
        text: `Your SMTP outbox (${host}:${port}) has been verified and is ready for live outreach campaigns.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
            <div style="display: inline-block; background: #ecfdf5; color: #047857; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 16px;">
              SMTP Outbox Connected
            </div>
            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
              SMTP Verification Succeeded
            </h2>
            <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              This test confirms that LeadPulse has authenticated with your outbound SMTP server.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; font-family: monospace; color: #1e293b;">
              <strong>Host:</strong> ${host}:${port}<br/>
              <strong>Sender:</strong> ${senderDisplay}<br/>
              <strong>User:</strong> ${user}
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
              Future outreach emails will transmit directly through this SMTP server.
            </p>
          </div>
        `
      });

      testMessageId = info.messageId;
    }

    return {
      success: true,
      message: testRecipient
        ? `SMTP connection verified! A real test email was delivered to ${testRecipient.trim()}.`
        : `SMTP connection verified successfully on ${host}:${port}!`,
      messageId: testMessageId
    };
  } catch (err: any) {
    console.error('[Mailer] SMTP connection error:', err.message);
    let friendlyMessage = err.message || 'SMTP connection failed';

    if (
      err.responseCode === 535 ||
      err.code === 'EAUTH' ||
      err.message?.includes('535') ||
      err.message?.includes('Username and Password not accepted')
    ) {
      friendlyMessage = 'Authentication failed (535): Invalid SMTP username or password for this server.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      friendlyMessage = `Connection timed out while connecting to ${host}:${port}. Please verify your server address, port (587 or 465), and firewall settings.`;
    } else if (err.code === 'ENOTFOUND') {
      friendlyMessage = `Could not resolve SMTP hostname (${host}). Please check the server address.`;
    }

    return {
      success: false,
      message: friendlyMessage,
      error: err.message
    };
  }
}

/**
 * Transmits genuine outreach emails across the Internet via configured SMTP.
 * Throws clean error if SMTP is not configured. No dummy fallbacks.
 */
export async function sendDirectEmail(options: SendMailOptions): Promise<DispatchResult> {
  const {
    to,
    subject,
    html,
    text,
    fromName,
    fromEmail,
    replyTo,
    userSmtp
  } = options;

  // Resolve active SMTP settings
  const smtpHost = userSmtp?.host || process.env.SMTP_HOST;
  const smtpPort = Number(userSmtp?.port || process.env.SMTP_PORT || 587);
  const smtpUser = userSmtp?.user || process.env.SMTP_USER;
  const smtpPass = userSmtp?.pass || process.env.SMTP_PASS;
  const smtpSecure = userSmtp?.secure !== undefined
    ? userSmtp.secure
    : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      'No SMTP Outbox connected. Please configure your SMTP server credentials in Outbox Settings to dispatch outreach.'
    );
  }

  const senderEmail = (fromEmail || userSmtp?.fromEmail || smtpUser).trim();
  const senderDisplayName = (fromName || userSmtp?.fromName || 'LeadPulse Operator').trim();
  const formattedSender = `"${senderDisplayName}" <${senderEmail}>`;

  const transporter: Transporter = nodemailer.createTransport({
    host: smtpHost.trim(),
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser.trim(),
      pass: smtpPass.trim()
    },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions: any = {
    from: formattedSender,
    to: to.trim(),
    subject: subject.trim(),
    text: text || '',
    html: html
  };

  const resolvedReplyTo = (replyTo || userSmtp?.replyTo || senderEmail).trim();
  if (resolvedReplyTo) {
    mailOptions.replyTo = resolvedReplyTo;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId || `smtp_${Date.now()}`,
      recipient: to,
      previewUrl: null,
      status: 'delivered',
      response: info.response || '250 Message accepted for delivery',
      providerUsed: `Direct SMTP (${smtpHost})`
    };
  } catch (sendErr: any) {
    console.error(`[Mailer] Direct SMTP dispatch error for ${to}:`, sendErr.message);
    throw new Error(`SMTP Delivery Error: ${sendErr.message}`);
  }
}
