import React from 'react';
import { motion } from 'framer-motion';
import LikelyRangeBadge from './LikelyRangeBadge';

export default function Section2Baseline({ baseline }) {
    if (!baseline) return null;

    return (
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-blue-500 p-6 mb-4 relative overflow-hidden">
            {/* Label Tag */}
            <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl">
                ML-DRIVEN
            </div>

            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Layer 1: Baseline Risk Estimation
                </h3>
                <p className="text-xs text-slate-500 ml-4">
                    Machine Learning Model (CatBoost) prediction based on demographics only.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Left: Base Cost */}
                <div className="flex-shrink-0 w-full md:w-1/3 p-4 bg-slate-50 rounded border border-slate-100 text-center">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Base Predicted Cost</div>
                    <div className="text-2xl font-bold text-blue-600 mt-1">
                        ₹{baseline.mean.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Before Condition Adjustment</div>
                    {baseline.range && (
                        <div className="mt-3 flex justify-center">
                            <LikelyRangeBadge range={baseline.range} label="Baseline Range (80% Conf.)" />
                        </div>
                    )}
                </div>

                {/* Right: Feature Contributions (SHAP) */}
                <div className="flex-grow w-full">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Baseline Model Contributors:</div>
                    <div className="space-y-2">
                        {baseline.shap_values && baseline.shap_values.map((item, idx) => {
                            // Only show top 5 for brevity in this section
                            if (idx > 4) return null;

                            const isPositive = item.amount > 0;
                            const widthPercent = Math.min(Math.abs(item.amount) / 5000 * 100, 100); // Normalize visual width roughly

                            return (
                                <div key={idx} className="flex items-center text-xs">
                                    <div className="w-32 text-slate-600 truncate mr-2" title={item.label}>{item.label}</div>
                                    <div className="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden relative">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${widthPercent}%` }}
                                            className={`h-full ${isPositive ? 'bg-red-400' : 'bg-green-400'}`}
                                        />
                                    </div>
                                    <div className={`w-20 text-right font-mono ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                                        {isPositive ? '+' : ''}₹{Math.abs(item.amount).toLocaleString()}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <p className="text-[10px] text-slate-300 mt-2 text-right">
                        *Red adds cost, Green reduces cost. Sorted by absolute impact.
                    </p>
                </div>
            </div>
        </div>
    );
}
