import React from 'react';
import LikelyRangeBadge from './LikelyRangeBadge';

export default function Section1Summary({ finalEstimate }) {
    if (!finalEstimate) return null;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
            <div className="flex flex-col items-center justify-center gap-3">
                <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">
                    Predicted Annual Healthcare Cost
                </h2>
                <div className="text-3xl font-bold text-slate-800">
                    ₹{finalEstimate.mean.toLocaleString()}
                </div>
                {finalEstimate.range && (
                    <LikelyRangeBadge range={finalEstimate.range} />
                )}
                <p className="text-[10px] text-slate-400 mt-1 italic">
                    Derived from layered risk and severity analysis
                </p>
            </div>
        </div>
    );
}
