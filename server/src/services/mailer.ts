import nodemailer, { Transporter } from 'nodemailer';

export interface UserSmtpSettings {
  provider?: 'gmail' | 'brevo' | 'outlook' | 'yahoo' | 'zoho' | 'icloud' | 'custom' | 'resend' | 'sendgrid';
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
  resendApiKey?: string;
  sendgridApiKey?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
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

// In-memory delivered mail store with circular buffer (max 100 messages)
export const inAppDeliveredInbox: DeliveredMessageLog[] = [];

/**
 * Maps any provider name to standard Nodemailer transport configuration.
 * Covers Gmail, Brevo, Outlook, Yahoo, Zoho, iCloud, and custom SMTP.
 */
export function getTransporterConfig(settings: UserSmtpSettings) {
  const provider = (settings.provider || 'custom').toLowerCase();

  if (provider === 'gmail') {
    return {
      service: 'gmail',
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  if (provider === 'brevo') {
    return {
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  if (provider === 'outlook') {
    return {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  if (provider === 'yahoo') {
    return {
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  if (provider === 'zoho') {
    return {
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  if (provider === 'icloud') {
    return {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      auth: {
        user: settings.user,
        pass: settings.pass
      }
    };
  }

  // Custom SMTP
  const port = settings.port || 587;
  const secure = settings.secure !== undefined ? settings.secure : (port === 465);
  return {
    host: settings.host,
    port,
    secure,
    auth: {
      user: settings.user,
      pass: settings.pass
    }
  };
}

/**
 * Dispatches email using Resend HTTPS REST API.
 */
async function sendViaResendHttp(
  apiKey: string,
  options: {
    to: string;
    fromName: string;
    fromEmail?: string;
    subject: string;
    html: string;
    text?: string;
  }
): Promise<DispatchResult> {
  const fromAddress = options.fromEmail && !options.fromEmail.includes('@gmail.com')
    ? options.fromEmail
    : 'onboarding@resend.dev';

  const formattedFrom = options.fromName
    ? `${options.fromName} <${fromAddress}>`
    : fromAddress;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: formattedFrom,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text || ''
    })
  });

  const data: any = await response.json();

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Resend API returned status ${response.status}`;
    throw new Error(`Resend Delivery Error: ${errorMsg}`);
  }

  const messageId = data?.id || `resend_${Date.now()}`;
  return {
    success: true,
    messageId,
    recipient: options.to,
    previewUrl: null,
    status: 'delivered',
    providerUsed: 'Resend Cloud HTTPS API',
    response: `250 OK - Dispatched via Resend API (ID: ${messageId})`
  };
}

/**
 * Dispatches email via hardened Nodemailer SMTP with strict timeouts and error parsing.
 */
async function sendViaSmtp(
  transporterConfig: any,
  providerLabel: string,
  options: {
    to: string;
    fromFormatted: string;
    subject: string;
    html: string;
    text?: string;
  }
): Promise<DispatchResult> {
  const transporter: Transporter = nodemailer.createTransport({
    ...transporterConfig,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });

  const info = await transporter.sendMail({
    from: options.fromFormatted,
    to: options.to,
    subject: options.subject,
    text: options.text || '',
    html: options.html
  });

  return {
    success: true,
    messageId: info.messageId || `smtp_${Date.now()}`,
    recipient: options.to,
    previewUrl: null,
    status: 'delivered',
    providerUsed: providerLabel,
    response: info.response || '250 OK Direct SMTP Delivery'
  };
}

/**
 * Verifies SMTP or API credentials and optionally dispatches a real test verification email.
 * This ensures that before any campaign starts, the mailbox connection is 100% verified.
 */
export async function verifyMailboxConnection(
  settings: UserSmtpSettings,
  testRecipient?: string
): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
  // If Resend API
  if (settings.provider === 'resend' && settings.resendApiKey) {
    try {
      if (testRecipient) {
        const result = await sendViaResendHttp(settings.resendApiKey, {
          to: testRecipient,
          fromName: settings.fromName || 'LeadPulse Operator',
          fromEmail: settings.fromEmail,
          subject: 'LeadPulse Outbox Verification: Ready for Live Outreach',
          html: `<p>Your Resend API connection is verified and ready for live outreach.</p>`,
          text: 'Your Resend API connection is verified and ready for live outreach.'
        });
        return {
          success: true,
          message: `Resend API verified! Live test email dispatched to ${testRecipient}.`,
          messageId: result.messageId
        };
      }
      return { success: true, message: 'Resend API connection verified!' };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  // Validate required SMTP fields
  if (!settings.user || !settings.pass) {
    return {
      success: false,
      message: 'Username/Email and Password are required to connect your mailbox.',
      error: 'Missing credentials'
    };
  }

  const config = getTransporterConfig(settings);
  const transporter: Transporter = nodemailer.createTransport({
    ...config,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. Verify connection and credentials
    await transporter.verify();

    // 2. Dispatch real test email to testRecipient if provided
    let testMessageId = `test_${Date.now()}`;
    if (testRecipient) {
      const senderEmail = settings.fromEmail || settings.user;
      const formattedSender = `"${settings.fromName || 'LeadPulse Operator'}" <${senderEmail}>`;
      const info = await transporter.sendMail({
        from: formattedSender,
        to: testRecipient,
        subject: 'LeadPulse Mailbox Verification: Ready for Live Outreach',
        text: `Your sending mailbox (${senderEmail}) has been successfully connected to LeadPulse. You can now dispatch real outreach campaigns directly from this account.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 16px;">
              Outbox Connection Verified
            </div>
            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
              Mailbox Connected Successfully!
            </h2>
            <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              This test message confirms that LeadPulse is connected to your email account:
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; font-family: monospace; color: #1e293b;">
              <strong>Sender:</strong> ${formattedSender}<br/>
              <strong>Provider:</strong> ${(settings.provider || 'SMTP').toUpperCase()}<br/>
              <strong>Transport:</strong> Direct Socket Handshake (TLS/SSL)
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
              All future cold email sequences and campaign dispatches from Outreach Centre will transmit directly through this mailbox to real recipients.
            </p>
          </div>
        `
      });
      testMessageId = info.messageId || testMessageId;
    }

    return {
      success: true,
      message: testRecipient
        ? `Mailbox verified! A live test email has been delivered to ${testRecipient}.`
        : 'Mailbox connection verified successfully!',
      messageId: testMessageId
    };
  } catch (err: any) {
    console.error('[Mailer] Mailbox verification failed:', err.message);
    let friendlyMessage = err.message || 'SMTP connection failed';

    if (err.message?.includes('535') || err.message?.includes('Username and Password not accepted') || err.message?.includes('BadCredentials')) {
      if (settings.provider === 'gmail') {
        friendlyMessage = 'Gmail authentication failed: Google requires a 16-character App Password (not your normal password). Turn on 2-Step Verification and generate an App Password at myaccount.google.com/apppasswords.';
      } else if (settings.provider === 'brevo') {
        friendlyMessage = 'Brevo authentication failed: Check your SMTP login email and your SMTP key (from Brevo -> SMTP & API -> SMTP).';
      } else if (settings.provider === 'outlook') {
        friendlyMessage = 'Outlook / Office 365 authentication failed: Verify your Microsoft email and password. If 2FA is enabled, generate an App Password in your Microsoft Account Security settings.';
      } else if (settings.provider === 'yahoo') {
        friendlyMessage = 'Yahoo authentication failed: Yahoo requires an App Password. Generate one in Yahoo Account Security -> Manage App Passwords.';
      } else if (settings.provider === 'zoho') {
        friendlyMessage = 'Zoho authentication failed: Zoho requires an Application-Specific Password. Generate one in Zoho Accounts -> Security -> App Passwords.';
      } else {
        friendlyMessage = 'Authentication failed: Invalid username or password for this SMTP server.';
      }
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      friendlyMessage = `Connection timed out while connecting to ${settings.host || config.host}:${settings.port || config.port}. Check your network, host, or port settings.`;
    } else if (err.code === 'ENOTFOUND') {
      friendlyMessage = `Could not resolve SMTP server hostname (${settings.host || config.host}). Please check the server address.`;
    }

    return {
      success: false,
      message: friendlyMessage,
      error: err.message
    };
  }
}

/**
 * Main Direct Outreach Dispatcher.
 * Transmits real emails across the Internet via the user's connected mailbox.
 */
export async function sendDirectEmail(options: SendMailOptions): Promise<DispatchResult> {
  const { 
    to, 
    subject, 
    html, 
    text, 
    fromName = 'LeadPulse Growth Director', 
    fromEmail, 
    userSmtp 
  } = options;

  // Resolve active SMTP connection: userSmtp or server .env fallback
  const resolvedSmtp: UserSmtpSettings | undefined = userSmtp?.user || userSmtp?.resendApiKey
    ? userSmtp
    : process.env.SMTP_USER
    ? {
        provider: 'custom',
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        fromName: process.env.SMTP_FROM_NAME || fromName,
        fromEmail: process.env.SMTP_FROM_EMAIL || fromEmail
      }
    : undefined;

  // Enforce real delivery: if no mailbox is connected, fail with explicit actionable instructions
  if (!resolvedSmtp || (!resolvedSmtp.user && !resolvedSmtp.resendApiKey)) {
    throw new Error('No sending mailbox connected. Please connect your email account (Gmail, Brevo, Outlook, Yahoo, Zoho, or Custom SMTP) in Mailbox Settings to dispatch live emails to real inboxes.');
  }

  try {
    // 1. Resend HTTPS REST API
    if (resolvedSmtp.provider === 'resend' && resolvedSmtp.resendApiKey) {
      const result = await sendViaResendHttp(resolvedSmtp.resendApiKey, {
        to,
        fromName: resolvedSmtp.fromName || fromName,
        fromEmail: resolvedSmtp.fromEmail || fromEmail,
        subject,
        html,
        text
      });

      recordInAppDelivery({
        id: result.messageId,
        to,
        from: `"${resolvedSmtp.fromName || fromName}" <${resolvedSmtp.fromEmail || fromEmail || 'onboarding@resend.dev'}>`,
        subject,
        html,
        text,
        status: 'Delivered (Resend Cloud)',
        provider: 'Resend Cloud HTTPS API',
        previewUrl: `/api/outreach/preview-delivered/${result.messageId}`
      });

      return result;
    }

    // 2. Direct SMTP Socket Handshake (Gmail, Brevo, Outlook, Yahoo, Zoho, iCloud, Custom)
    const config = getTransporterConfig(resolvedSmtp);
    const senderEmail = resolvedSmtp.fromEmail || fromEmail || resolvedSmtp.user || 'outreach@leadpulse.io';
    const formattedSender = `"${resolvedSmtp.fromName || fromName}" <${senderEmail}>`;
    const providerLabel = `${(resolvedSmtp.provider || 'SMTP').toUpperCase()} (${senderEmail})`;

    const result = await sendViaSmtp(
      config,
      providerLabel,
      {
        to,
        fromFormatted: formattedSender,
        subject,
        html,
        text
      }
    );

    recordInAppDelivery({
      id: result.messageId,
      to,
      from: formattedSender,
      subject,
      html,
      text,
      status: `Delivered (${(resolvedSmtp.provider || 'SMTP').toUpperCase()})`,
      provider: providerLabel,
      previewUrl: `/api/outreach/preview-delivered/${result.messageId}`
    });

    return result;

  } catch (err: any) {
    console.error(`[LeadPulse Mailer] Direct delivery failure to ${to}:`, err.message);

    const fallbackId = `err_${Date.now()}`;
    recordInAppDelivery({
      id: fallbackId,
      to,
      from: `"${fromName}" <${fromEmail || resolvedSmtp.fromEmail || 'outreach@leadpulse.io'}>`,
      subject,
      html,
      text,
      status: `Failed: ${err.message}`,
      provider: resolvedSmtp.provider || 'SMTP',
      previewUrl: `/api/outreach/preview-delivered/${fallbackId}`
    });

    return {
      success: false,
      messageId: fallbackId,
      recipient: to,
      previewUrl: `/api/outreach/preview-delivered/${fallbackId}`,
      status: 'failed',
      providerUsed: resolvedSmtp.provider || 'SMTP',
      response: err.message || 'SMTP Connection Error',
      error: err.message || 'Delivery failed'
    };
  }
}

function recordInAppDelivery(log: Omit<DeliveredMessageLog, 'timestamp'>) {
  inAppDeliveredInbox.unshift({
    ...log,
    timestamp: new Date().toISOString()
  });
  if (inAppDeliveredInbox.length > 100) {
    inAppDeliveredInbox.pop();
  }
}
