import React from 'react';

export default function Section6Guidance({ guidance, loading }) {
    if (loading) {
        return (
            <div className="bg-white rounded-lg p-6 border border-slate-200 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (!guidance) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6 overflow-hidden">
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                        Clinical Guidance & Next Steps
                    </h3>
                    <p className="text-xs text-indigo-700 mt-1">
                        Offline-curated medical guidelines for <strong>{guidance.disease}</strong>
                    </p>
                </div>
                <div className="text-[10px] text-right text-indigo-400">
                    Sources: {guidance.sources.join(', ')}<br />
                    Last Reviewed: {guidance.lastReviewedAt}
                </div>
            </div>

            <div className="divide-y divide-slate-100">
                {guidance.sections.map((section, idx) => (
                    <div key={idx} className="p-5 hover:bg-slate-50 transition-colors">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                            {section.type}
                        </h4>
                        <ul className="space-y-2">
                            {section.steps.map((step, sIdx) => (
                                <li key={sIdx} className="text-sm text-slate-600 flex items-start gap-3">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0"></span>
                                    <span className="leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-[10px] text-slate-400 text-center italic">
                Disclaimer: This content is for informational purposes only and does not constitute medical advice, diagnosis, or treatment.
            </div>
        </div>
    );
}
