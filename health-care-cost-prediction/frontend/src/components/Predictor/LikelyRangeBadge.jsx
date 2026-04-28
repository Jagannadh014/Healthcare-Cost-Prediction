import React from 'react';

/**
 * LikelyRangeBadge
 * Displays a confidence interval range in the compact pill style shown in the design.
 *
 * Props:
 *   range   – [low, high] numbers (e.g. [15512.6, 17960.54])
 *   label   – optional override for the header text (default "LIKELY RANGE (80% CONF.)")
 *   className – extra classes for the wrapper
 */
export default function LikelyRangeBadge({ range, label, className = '' }) {
    if (!range || range.length !== 2) return null;

    const [low, high] = range;

    const fmt = (n) =>
        '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    return (
        <div
            className={`inline-flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 ${className}`}
        >
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                {label ?? 'Likely Range (80% Conf.)'}
            </span>
            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                {fmt(low)}&nbsp;–&nbsp;{fmt(high)}
            </span>
        </div>
    );
}
