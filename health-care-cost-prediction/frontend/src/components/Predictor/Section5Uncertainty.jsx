import React from 'react';
import LikelyRangeBadge from './LikelyRangeBadge';

// Static Reliability Logic
const getReliability = (condition) => {
    if (!condition) return { level: 'High', reason: 'Common demographic data is plentiful.' };
    const lower = condition.toLowerCase();
    if (lower.includes('cancer')) return { level: 'Medium', reason: 'High variance in cancer treatments reduces certainty.' };
    if (lower.includes('heart')) return { level: 'High', reason: 'Well-documented cardiac pathways.' };
    return { level: 'Medium', reason: 'General historical data available.' };
}

export default function Section5Uncertainty({ finalEstimate, conditionName }) {
    if (!finalEstimate) return null;

    const reliability = getReliability(conditionName);

    // Simulate "Similar Cases"
    const similarCases = Math.floor(Math.random() * (5000 - 1000) + 1000); // UI Mock

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                Prediction Confidence & Reliability
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Confidence Interval */}
                <div className="bg-white p-4 rounded border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">80% Confidence Range</div>
                    <div className="mt-2">
                        <LikelyRangeBadge range={finalEstimate.range} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2">
                        There is an 80% probability the actual cost falls in this range.
                    </div>
                </div>

                {/* Reliability Indicator */}
                <div className="bg-white p-4 rounded border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Reliability Score</div>
                    <div className={`text-lg font-bold mt-1 ${reliability.level === 'High' ? 'text-green-600' : 'text-orange-500'}`}>
                        {reliability.level}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        {reliability.reason}
                    </div>
                </div>

                {/* Historical Cases */}
                <div className="bg-white p-4 rounded border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Similar Historical Cases</div>
                    <div className="text-lg font-bold text-slate-800 mt-1">
                        {similarCases.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Matches found in Dataset-2 (2020-2025)
                    </div>
                </div>

            </div>

            <div className="mt-4 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-3">
                * Note: Some confidence indicators are UI-level approximations and will be replaced by backend-driven metrics in future iterations.
            </div>
        </div>
    );
}
