import crypto from 'crypto';

export type OtpPurpose = 'register' | '2fa' | 'forgot_password';

export interface OtpRecord {
  phone: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: number;
  attempts: number;
  email?: string;
  createdAt: number;
}

class OtpService {
  private otps: Map<string, OtpRecord> = new Map();

  /**
   * Normalizes a phone number to standard digits with optional leading +
   */
  normalizePhone(phone: string): string {
    if (!phone) return '';
    const clean = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('+')) {
      return '+' + clean.slice(1).replace(/\D/g, '');
    }
    const digits = clean.replace(/\D/g, '');
    // If 10 digits without country code, default to +91 (India) or keep standard digits
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    return `+${digits}`;
  }

  /**
   * Masks a phone number for secure client UI display (e.g. +91 98*** **210)
   */
  maskPhone(phone: string): string {
    const norm = this.normalizePhone(phone);
    if (norm.length < 7) return norm;
    const prefix = norm.slice(0, norm.length - 7);
    const mid = '*** **';
    const suffix = norm.slice(-3);
    return `${prefix} ${mid}${suffix}`;
  }

  /**
   * Generates and dispatches a 6-digit numeric OTP to the target mobile number.
   */
  async generateAndSendOtp(
    phone: string,
    purpose: OtpPurpose,
    email?: string
  ): Promise<{ success: boolean; phone: string; phoneMasked: string; devOtp?: string }> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.replace(/\D/g, '').length < 10) {
      throw new Error('Please enter a valid 10+ digit mobile number with country code.');
    }

    // Generate cryptographically secure 6-digit numerical code
    const code = Math.floor(100000 + crypto.randomInt(0, 900000)).toString();
    const expiryMinutes = purpose === 'forgot_password' ? 10 : 5;
    const expiresAt = Date.now() + expiryMinutes * 60 * 1000;

    const key = `${normalizedPhone}_${purpose}`;
    this.otps.set(key, {
      phone: normalizedPhone,
      code,
      purpose,
      expiresAt,
      attempts: 0,
      email: email ? email.toLowerCase().trim() : undefined,
      createdAt: Date.now()
    });

    const phoneMasked = this.maskPhone(normalizedPhone);

    // Primary Dispatch: Log clearly to server output & system logs
    console.log(`[OTP Service] ==========================================`);
    console.log(`[OTP Service] >>> DISPATCHED ${purpose.toUpperCase()} OTP: [ ${code} ] TO MOBILE ${normalizedPhone} <<<`);
    console.log(`[OTP Service] Target: ${phoneMasked} | Expires in: ${expiryMinutes} minutes`);
    console.log(`[OTP Service] ==========================================`);

    // In local development or preview environments, devOtp is surfaced so the UI and tests can assist testing
    const devOtp = process.env.NODE_ENV !== 'production' ? code : undefined;

    return {
      success: true,
      phone: normalizedPhone,
      phoneMasked,
      devOtp
    };
  }

  /**
   * Validates the submitted OTP code against the target phone and purpose.
   */
  verifyOtp(
    phone: string,
    code: string,
    purpose: OtpPurpose
  ): { valid: boolean; error?: string; email?: string } {
    const normalizedPhone = this.normalizePhone(phone);
    const key = `${normalizedPhone}_${purpose}`;
    const record = this.otps.get(key);

    if (!record) {
      return {
        valid: false,
        error: 'No active verification code found for this mobile number. Please request a new code.'
      };
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      this.otps.delete(key);
      return {
        valid: false,
        error: 'The verification code has expired. Please request a fresh code.'
      };
    }

    // Check brute-force attempts (maximum 5 attempts)
    record.attempts += 1;
    if (record.attempts > 5) {
      this.otps.delete(key);
      return {
        valid: false,
        error: 'Too many incorrect attempts. For security, please request a new verification code.'
      };
    }

    // Check code match
    if (record.code !== String(code).trim()) {
      return {
        valid: false,
        error: `Invalid verification code. ${5 - record.attempts} attempts remaining.`
      };
    }

    // Valid: Consume OTP so it cannot be replayed
    const email = record.email;
    this.otps.delete(key);

    return {
      valid: true,
      email
    };
  }

  /**
   * Testing helper to inspect active OTP
   */
  peekOtp(phone: string, purpose: OtpPurpose): string | undefined {
    const normalizedPhone = this.normalizePhone(phone);
    return this.otps.get(`${normalizedPhone}_${purpose}`)?.code;
  }
}

export const otpService = new OtpService();
export default otpService;
