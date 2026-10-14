import nodemailer, { Transporter } from 'nodemailer';

export interface UserSmtpSettings {
  provider?: 'sendgrid' | 'smtp';
  apiKey?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  verifiedAt?: string;
  isRenderEnv?: boolean;
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
 * Verifies SendGrid connection via REST API over HTTPS (Port 443).
 * Render blocks SMTP ports 587 and 465, so HTTPS Web API is required for 100% reliable cloud delivery.
 */
export async function verifySendGridConnection(
  settings: {
    apiKey?: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
  },
  testRecipient?: string
): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
  const apiKey = (settings.apiKey || process.env.SENDGRID_API_KEY || '').trim();
  const fromEmail = (settings.fromEmail || process.env.SENDGRID_FROM_EMAIL || '').trim();
  const fromName = (settings.fromName || 'LeadPulse Operator').trim();

  if (!apiKey) {
    return {
      success: false,
      message: 'SendGrid API Key is required. Please generate an API Key in SendGrid Settings > API Keys.'
    };
  }

  if (!fromEmail) {
    return {
      success: false,
      message: 'Verified Sender Email is required. Enter the email address you verified in SendGrid Single Sender Verification.'
    };
  }

  try {
    // 1. Authenticate with SendGrid REST API over HTTPS (Port 443)
    const scopeRes = await fetch('https://api.sendgrid.com/v3/scopes', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (scopeRes.status === 401) {
      return {
        success: false,
        message: 'Authentication failed (401 Unauthorized): Invalid SendGrid API Key. Check that your key starts with "SG." and has not been revoked.'
      };
    }

    if (scopeRes.status === 403) {
      return {
        success: false,
        message: 'Permission denied (403 Forbidden): Your SendGrid API Key lacks required permissions. Ensure it has "Full Access" or "Mail Send" permission.'
      };
    }

    if (!scopeRes.ok) {
      const errText = await scopeRes.text();
      return {
        success: false,
        message: `SendGrid API error (${scopeRes.status}): ${errText}`
      };
    }

    let testMessageId: string | undefined;

    // 2. If testRecipient is provided, send a genuine verification email over HTTPS
    if (testRecipient && testRecipient.trim()) {
      const formattedSender = `"${fromName}" <${fromEmail}>`;
      const replyToAddress = (settings.replyTo || fromEmail).trim();

      const sendPayload: any = {
        personalizations: [
          {
            to: [{ email: testRecipient.trim() }]
          }
        ],
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: 'LeadPulse Outbox Verification: SendGrid Web API Connected',
        content: [
          {
            type: 'text/plain',
            value: `Your SendGrid Web API outbox has been verified on Render over HTTPS (Port 443) and is ready for live outreach campaigns.`
          },
          {
            type: 'text/html',
            value: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
                <div style="display: inline-block; background: #ecfdf5; color: #047857; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 16px;">
                  Render + SendGrid Web API Active
                </div>
                <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                  SendGrid Outbox Verified
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                  This test confirms that LeadPulse has authenticated with SendGrid's Web API over secure HTTPS (Port 443).
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; font-family: monospace; color: #1e293b;">
                  <strong>Transport:</strong> SendGrid REST API v3 (Port 443 HTTPS)<br/>
                  <strong>Sender Identity:</strong> ${formattedSender}<br/>
                  <strong>Render Compatibility:</strong> 100% (No SMTP Port 587/465 Blocks)
                </div>
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                  Cold outreach campaigns and follow-up dispatches will transmit directly through this verified SendGrid channel.
                </p>
              </div>
            `
          }
        ]
      };

      if (replyToAddress) {
        sendPayload.reply_to = { email: replyToAddress };
      }

      const sendRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendPayload)
      });

      if (!sendRes.ok) {
        const errorData: any = await sendRes.json().catch(() => ({}));
        const rawMsg = errorData.errors?.[0]?.message || sendRes.statusText;
        if (sendRes.status === 403 || rawMsg.includes('does not match a verified Sender Identity')) {
          return {
            success: false,
            message: `SendGrid Sender Identity verification required: The email "${fromEmail}" has not been verified yet in SendGrid. Go to SendGrid Settings > Sender Authentication > Single Sender Verification to verify your sender identity.`,
            error: rawMsg
          };
        }
        return {
          success: false,
          message: `SendGrid test delivery failed (${sendRes.status}): ${rawMsg}`,
          error: rawMsg
        };
      }

      testMessageId = sendRes.headers.get('x-message-id') || `sg_${Date.now()}`;
    }

    return {
      success: true,
      message: testRecipient
        ? `SendGrid Web API verified! Real test email delivered to ${testRecipient.trim()} via HTTPS (Port 443).`
        : 'SendGrid Web API verified successfully over HTTPS (Port 443)!',
      messageId: testMessageId
    };
  } catch (err: any) {
    console.error('[Mailer] SendGrid verification error:', err.message);
    return {
      success: false,
      message: `Failed to connect to SendGrid Web API: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * Universal verification router: routes SendGrid API keys to HTTPS verification,
 * and legacy SMTP settings to socket verification (for local development only).
 */
export async function verifyMailboxConnection(
  settings: UserSmtpSettings,
  testRecipient?: string
): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
  const isSendGrid = Boolean(
    settings.apiKey ||
    settings.provider === 'sendgrid' ||
    (settings.host && settings.host.toLowerCase().includes('sendgrid')) ||
    (settings.user && settings.user.toLowerCase() === 'apikey')
  );

  if (isSendGrid) {
    const resolvedApiKey = (settings.apiKey || (settings.user === 'apikey' ? settings.pass : '') || process.env.SENDGRID_API_KEY || '').trim();
    return verifySendGridConnection({
      apiKey: resolvedApiKey,
      fromEmail: settings.fromEmail || settings.user || '',
      fromName: settings.fromName,
      replyTo: settings.replyTo
    }, testRecipient);
  }

  // Legacy SMTP socket verification (fallback for local development only)
  const host = (settings.host || '').trim();
  const port = Number(settings.port || 587);
  const user = (settings.user || '').trim();
  const pass = (settings.pass || '').trim();
  const fromName = (settings.fromName || 'LeadPulse Operator').trim();
  const fromEmail = (settings.fromEmail || user).trim();

  if (!host || !port || !user || !pass) {
    return {
      success: false,
      message: 'Render blocks raw SMTP ports 587 and 465. Please connect your SendGrid API Key for 100% reliable HTTPS delivery.'
    };
  }

  const isSecure = settings.secure !== undefined ? settings.secure : (port === 465);

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();

    let testMessageId: string | undefined;
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
          </div>
        `
      });

      testMessageId = info.messageId;
    }

    return {
      success: true,
      message: testRecipient
        ? `SMTP connection verified! Real test email delivered to ${testRecipient.trim()}.`
        : `SMTP connection verified successfully on ${host}:${port}!`,
      messageId: testMessageId
    };
  } catch (err: any) {
    console.error('[Mailer] SMTP socket error:', err.message);
    let friendlyMessage = err.message || 'SMTP connection failed';
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'ECONNREFUSED') {
      friendlyMessage = `Connection to ${host}:${port} timed out or was blocked. Render blocks outbound SMTP ports 25, 465, and 587. Please use SendGrid Web API over HTTPS (Port 443) instead.`;
    }
    return {
      success: false,
      message: friendlyMessage,
      error: err.message
    };
  }
}

/**
 * Transmits genuine outreach emails.
 * Primary: SendGrid REST API over HTTPS (Port 443) - zero timeouts on Render.
 * Fallback: Nodemailer SMTP socket for local development.
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

  // 1. SendGrid Web API Dispatch (Port 443 HTTPS - 100% Render compatible)
  const isSendGrid = Boolean(
    userSmtp?.apiKey ||
    userSmtp?.provider === 'sendgrid' ||
    process.env.SENDGRID_API_KEY ||
    (userSmtp?.host && userSmtp.host.toLowerCase().includes('sendgrid')) ||
    (userSmtp?.user && userSmtp.user.toLowerCase() === 'apikey')
  );

  const sendGridKey = (userSmtp?.apiKey || (userSmtp?.user === 'apikey' ? userSmtp.pass : '') || process.env.SENDGRID_API_KEY || '').trim();

  if (isSendGrid && sendGridKey) {
    const senderEmail = (fromEmail || userSmtp?.fromEmail || process.env.SENDGRID_FROM_EMAIL || userSmtp?.user || '').trim();
    const senderDisplayName = (fromName || userSmtp?.fromName || 'LeadPulse Operator').trim();
    const resolvedReplyTo = (replyTo || userSmtp?.replyTo || senderEmail).trim();

    if (!senderEmail) {
      throw new Error('Sender Email is required for SendGrid dispatch.');
    }

    const payload: any = {
      personalizations: [
        {
          to: [{ email: to.trim() }]
        }
      ],
      from: {
        email: senderEmail,
        name: senderDisplayName
      },
      subject: subject.trim(),
      content: [
        {
          type: 'text/plain',
          value: text || subject.trim()
        },
        {
          type: 'text/html',
          value: html
        }
      ]
    };

    if (resolvedReplyTo) {
      payload.reply_to = { email: resolvedReplyTo };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendGridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorJson: any = await response.json().catch(() => ({}));
        const errorMsg = errorJson.errors?.[0]?.message || `SendGrid API error (${response.status} ${response.statusText})`;
        if (response.status === 403 && errorMsg.includes('does not match a verified Sender Identity')) {
          throw new Error(`SendGrid Sender Identity verification required: "${senderEmail}" must be verified in SendGrid Settings > Sender Authentication.`);
        }
        throw new Error(errorMsg);
      }

      const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;

      const logRecord: DeliveredMessageLog = {
        id: messageId,
        to,
        from: `"${senderDisplayName}" <${senderEmail}>`,
        subject,
        html,
        text,
        timestamp: new Date().toISOString(),
        status: 'delivered',
        provider: 'SendGrid Web API (Port 443 HTTPS)',
        previewUrl: null
      };

      inAppDeliveredInbox.unshift(logRecord);
      if (inAppDeliveredInbox.length > 100) inAppDeliveredInbox.pop();

      return {
        success: true,
        messageId,
        recipient: to,
        previewUrl: null,
        status: 'delivered',
        response: '202 Accepted for delivery via SendGrid Web API (Port 443)',
        providerUsed: 'SendGrid Web API (Render Compatible)'
      };
    } catch (sendErr: any) {
      console.error(`[Mailer] SendGrid Web API dispatch error for ${to}:`, sendErr.message);
      throw new Error(`SendGrid Delivery Error: ${sendErr.message}`);
    }
  }

  // 2. Legacy SMTP Dispatch (fallback for local non-Render development)
  const smtpHost = userSmtp?.host || process.env.SMTP_HOST;
  const smtpPort = Number(userSmtp?.port || process.env.SMTP_PORT || 587);
  const smtpUser = userSmtp?.user || process.env.SMTP_USER;
  const smtpPass = userSmtp?.pass || process.env.SMTP_PASS;
  const smtpSecure = userSmtp?.secure !== undefined
    ? userSmtp.secure
    : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      'No SendGrid Outbox connected. Please configure your SendGrid API Key in Outbox Settings to dispatch outreach.'
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
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
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

    const logRecord: DeliveredMessageLog = {
      id: info.messageId || `smtp_${Date.now()}`,
      to,
      from: formattedSender,
      subject,
      html,
      text,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      provider: `Direct SMTP (${smtpHost})`,
      previewUrl: null
    };

    inAppDeliveredInbox.unshift(logRecord);
    if (inAppDeliveredInbox.length > 100) inAppDeliveredInbox.pop();

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
    if (sendErr.code === 'ETIMEDOUT' || sendErr.code === 'ECONNREFUSED') {
      throw new Error(`SMTP Port ${smtpPort} blocked: Render blocks outbound SMTP ports 587 and 465. Please switch to SendGrid Web API.`);
    }
    throw new Error(`SMTP Delivery Error: ${sendErr.message}`);
  }
}
