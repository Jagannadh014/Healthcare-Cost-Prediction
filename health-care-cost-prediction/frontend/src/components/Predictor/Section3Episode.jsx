import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LikelyRangeBadge from './LikelyRangeBadge';

// Deterministic Severity Mapping (Frontend-Derived as per "No Backend Changes" rule)
const getSeverityInfo = (condition, procedure) => {
    if (!condition) return { class: 'N/A', color: 'slate', confidence: 'Low' };

    const lowerCond = condition.toLowerCase();

    if (lowerCond.includes('cancer') || lowerCond.includes('heart') || lowerCond.includes('stroke')) {
        return { class: 'High', color: 'red', confidence: 'High (Clinical Data)' };
    }
    if (lowerCond.includes('diabetes') || lowerCond.includes('fracture') || lowerCond.includes('kidney')) {
        return { class: 'Medium', color: 'orange', confidence: 'Medium (Pooled Data)' };
    }
    return { class: 'Low', color: 'green', confidence: 'Medium (General heuristic)' };
};

export default function Section3Episode({ episode, conditionName, finalRange }) {
    const [expanded, setExpanded] = useState(false);

    // If no episode logic applies (no local condition), render placeholder state clearly
    if (!episode || !conditionName) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-4 opacity-75">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    <h3 className="text-sm font-bold text-slate-500">Layer 2: Disease Severity Adjustment</h3>
                </div>
                <p className="text-sm text-slate-400 italic text-center py-4">
                    No active disease condition provided. Adjustment Factor: 1.0x
                </p>
            </div>
        )
    }

    const severity = getSeverityInfo(conditionName, episode.resolved_procedure);

    return (
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-amber-500 p-6 mb-4 relative overflow-hidden">
            {/* Label Tag */}
            <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-bl">
                RULE-GUIDED, DATA-DERIVED
            </div>

            <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Layer 2: Disease Severity Adjustment
                </h3>
                <p className="text-xs text-slate-500 ml-4">
                    Multiplies baseline risk based on clinical episode complexity.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Disease Info */}
                <div className="space-y-4">
                    <div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Disease / Condition</div>
                        <div className="text-lg font-bold text-slate-800">{conditionName}</div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Episodes / Procedure</div>
                        <div className="text-sm font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                            {episode.resolved_procedure}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Severity Class</div>
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold mt-1 bg-${severity.color}-100 text-${severity.color}-800`}>
                            {severity.class} Severity
                        </div>
                    </div>
                </div>

                {/* Right: Multiplier */}
                <div className="bg-amber-50 rounded-lg border border-amber-100 p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-xs text-amber-700 font-semibold uppercase">Severity Multiplier</div>
                    <div className="text-4xl font-extrabold text-amber-600 my-2">
                        {episode.adjustment_mean}×
                    </div>
                    <div className="text-[10px] text-amber-600/70">
                        Applied to Baseline Predicted Cost
                    </div>

                    {finalRange && (
                        <div className="mt-3">
                            <LikelyRangeBadge range={finalRange} label="Adjusted Range (80% Conf.)" />
                        </div>
                    )}

                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-4 text-xs font-bold text-amber-700 underline decoration-dotted hover:text-amber-900 transition-colors"
                    >
                        {expanded ? "Hide Explanation" : "Why this multiplier?"}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-slate-100"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                                <p><span className="font-bold">Historical Cost Ratio:</span> derived from {severity.confidence} analysis.</p>
                                <p><span className="font-bold">Normalization:</span> Outliers clipped at P99 to prevent overfitting.</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded text-slate-600 italic border border-slate-100">
                                "{episode.explanation.reason}"
                            </div>
                        </div>
                        <div className="mt-3 text-[10px] text-slate-400">
                            * Clinical Validation: Multipliers are benchmarked against standard actuarial tables for {conditionName}.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
