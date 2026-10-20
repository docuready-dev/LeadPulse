import React from 'react';

export interface TokenDisplayProps {
  user?: any;
  leadCredits?: number;
  topupCredits?: number;
  baseDailyCredits?: number;
  plan?: string;
  className?: string;
  showTokensWord?: boolean;
  baseColorClass?: string;
  topupColorClass?: string;
  limitColorClass?: string;
  showTooltip?: boolean;
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  user,
  leadCredits,
  topupCredits,
  baseDailyCredits,
  plan,
  className = '',
  showTokensWord = false,
  baseColorClass,
  topupColorClass = 'text-slate-600',
  limitColorClass = 'text-slate-400',
  showTooltip = true
}) => {
  const currentPlan = (plan || user?.plan || 'free').toLowerCase();
  const defaultMaxDaily = currentPlan === 'basic' ? 600 : currentPlan === 'pro' ? 1500 : 15;
  
  const base = leadCredits !== undefined 
    ? Math.max(0, leadCredits) 
    : Math.max(0, user?.lead_credits ?? defaultMaxDaily);

  const topup = topupCredits !== undefined 
    ? Math.max(0, topupCredits) 
    : Math.max(0, user?.topup_credits ?? 0);

  const maxDaily = baseDailyCredits !== undefined 
    ? baseDailyCredits 
    : (user?.base_daily_credits || defaultMaxDaily);

  const tooltipText = showTooltip 
    ? `Daily base: ${base}/${maxDaily} (resets daily) | Top-up: ${topup} (used first, persists)`
    : undefined;

  return (
    <span className={`inline-flex items-baseline font-delight tabular-nums ${className}`} title={tooltipText}>
      {/* Base Daily Tokens */}
      <span className={baseColorClass || 'font-bold'}>{base}</span>

      {/* Top-Up Tokens (Different color: Dark Grey, used first) */}
      {topup > 0 && (
        <span className={`font-bold ml-0.5 ${topupColorClass}`} title={`${topup} Top-up tokens (used first)`}>
          +{topup}
        </span>
      )}

      {/* Max Base Daily Capacity */}
      <span className={`font-normal ml-0.5 ${limitColorClass}`}>
        /{maxDaily}
      </span>

      {/* Optional "tokens" suffix */}
      {showTokensWord && (
        <span className={`font-normal ml-1 text-[11px] ${limitColorClass}`}>
          tokens
        </span>
      )}
    </span>
  );
};

export default TokenDisplay;
