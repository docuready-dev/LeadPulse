// Unified Token and Credit Accounting Manager
// Architecture:
// 1. Base Daily Tokens (lead_credits): Resets daily to plan quota (Basic: 600, Pro: 1500, Free: 15)
// 2. Top-Up Tokens (topup_credits): Never resets daily, persists across days until consumed
// 3. Order of Consumption: Top-Up Tokens are used FIRST, then Base Daily Tokens
// 4. Format: [base]+[topup]/[baseLimit], e.g. 600+50/600 (where +50 is dark grey)

export const PLAN_DAILY_TOKENS: Record<string, number> = {
  free: 15,
  basic: 600,
  pro: 1500
};

export interface TokenStatus {
  lead_credits: number;
  topup_credits: number;
  base_daily_credits: number;
  total_available: number;
  last_token_reset_date: string;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Checks whether user is eligible for daily token reset and applies it.
 * - Basic resets to 600 every day
 * - Pro resets to 1500 every day (or custom base_daily_credits)
 * - Top-Up tokens (topup_credits) are NEVER reset and remain intact
 */
export function applyDailyTokenReset(userData: any): { userData: any; didReset: boolean } {
  if (!userData) {
    return { userData: {}, didReset: false };
  }

  const plan = (userData.plan || 'free').toLowerCase();
  const maxDaily = Number(userData.base_daily_credits) || PLAN_DAILY_TOKENS[plan] || 15;
  const todayUtc = getTodayDateString();
  const lastResetDate = userData.last_token_reset_date || '';

  let didReset = false;

  // Initialize topup_credits if missing
  if (userData.topup_credits === undefined) {
    userData.topup_credits = userData.has_topup && userData.lead_credits > maxDaily
      ? userData.lead_credits - maxDaily
      : 0;
  }

  // Daily reset check
  if (lastResetDate !== todayUtc) {
    if (plan === 'basic' || plan === 'pro') {
      userData.lead_credits = maxDaily;
      userData.base_daily_credits = maxDaily;
      userData.last_token_reset_date = todayUtc;
      didReset = true;
    } else if (plan === 'free') {
      const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
      const lastRefresh = userData.pool_refreshed_at ? new Date(userData.pool_refreshed_at).getTime() : 0;
      const isPastFourDays = lastRefresh === 0 || Date.now() - lastRefresh >= fourDaysMs;

      if (isPastFourDays || !userData.has_topup) {
        if (!userData.has_topup && (userData.lead_credits === undefined || userData.lead_credits > 15)) {
          userData.lead_credits = 15;
        }
      }
      userData.base_daily_credits = 15;
      userData.last_token_reset_date = todayUtc;
    }
  }

  // Ensure non-negative numbers
  userData.lead_credits = Math.max(0, Number(userData.lead_credits) || 0);
  userData.topup_credits = Math.max(0, Number(userData.topup_credits) || 0);
  userData.base_daily_credits = Math.max(1, Number(userData.base_daily_credits) || maxDaily);

  return { userData, didReset };
}

/**
 * Deducts tokens from user according to priority:
 * Top-Up tokens are deducted FIRST. Once exhausted, remaining tokens are deducted from Base Daily Tokens.
 */
export function deductTokens(userData: any, tokensNeeded: number): {
  success: boolean;
  topupUsed: number;
  baseUsed: number;
  newTopup: number;
  newBase: number;
  totalRemaining: number;
} {
  const currentTopup = Math.max(0, Number(userData.topup_credits) || 0);
  const currentBase = Math.max(0, Number(userData.lead_credits) || 0);
  const totalAvailable = currentTopup + currentBase;

  if (totalAvailable < tokensNeeded) {
    return {
      success: false,
      topupUsed: 0,
      baseUsed: 0,
      newTopup: currentTopup,
      newBase: currentBase,
      totalRemaining: totalAvailable
    };
  }

  // Top-Up tokens used first
  const topupUsed = Math.min(currentTopup, tokensNeeded);
  const newTopup = currentTopup - topupUsed;
  const remainingNeeded = tokensNeeded - topupUsed;

  // Remaining deducted from Base Daily Tokens
  const baseUsed = Math.min(currentBase, remainingNeeded);
  const newBase = currentBase - baseUsed;

  return {
    success: true,
    topupUsed,
    baseUsed,
    newTopup,
    newBase,
    totalRemaining: newTopup + newBase
  };
}

/**
 * Refunds tokens back to the user (e.g. if fewer contacts found than reserved).
 * Refunds to Top-Up first if top-up was previously consumed, or back to base.
 */
export function refundTokens(
  userData: any, 
  tokensToRefund: number, 
  originalTopupUsed: number = 0
): { newTopup: number; newBase: number; totalCredits: number } {
  let currentTopup = Math.max(0, Number(userData.topup_credits) || 0);
  let currentBase = Math.max(0, Number(userData.lead_credits) || 0);

  if (tokensToRefund <= 0) {
    return {
      newTopup: currentTopup,
      newBase: currentBase,
      totalCredits: currentTopup + currentBase
    };
  }

  // If topup was used in this query, refund back to topup first
  const refundToTopup = Math.min(tokensToRefund, originalTopupUsed);
  currentTopup += refundToTopup;

  const refundToBase = tokensToRefund - refundToTopup;
  currentBase += refundToBase;

  return {
    newTopup: currentTopup,
    newBase: currentBase,
    totalCredits: currentTopup + currentBase
  };
}
