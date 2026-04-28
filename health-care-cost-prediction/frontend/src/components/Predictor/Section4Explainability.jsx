import React, { useState } from 'react';
import { motion } from 'framer-motion';
import WhatIfSimulator from '../WhatIfSimulator'; // Assuming existing component can be reused/wrapped

// Fallback visualization for when specific deltas aren't available
function WaterfallFallback({ baseline, final, episode }) {
    const baselineCost = baseline.mean;
    const finalCost = final.mean;
    const diseaseCost = finalCost - baselineCost;

    const maxVal = finalCost;

    return (
        <div className="space-y-4 py-8 px-4">
            {/* Step 1: Baseline */}
            <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 text-right mr-4">Healthy Base</div>
                <div className="flex-grow bg-slate-100 rounded-full h-8 relative">
                    <div
                        className="bg-blue-500 h-full rounded-l-full absolute top-0 left-0 flex items-center pl-2 text-white text-xs font-bold"
                        style={{ width: `${(baselineCost / maxVal) * 100}%` }}
                    >
                        ₹{baselineCost.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Step 2: Disease Impact */}
            <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 text-right mr-4">Disease Effect</div>
                <div className="flex-grow bg-slate-100 rounded-full h-8 relative">
                    {/* Ghost bar for offset */}
                    <div className="absolute top-0 left-0 h-full w-full opacity-10 bg-slate-200 rounded-full"></div>

                    <div
                        className="bg-amber-500 h-full absolute top-0 flex items-center pl-2 text-white text-xs font-bold shadow-md z-10"
                        style={{
                            left: `${(baselineCost / maxVal) * 100}%`,
                            width: `${(diseaseCost / maxVal) * 100}%`,
                            minWidth: '2px'
                        }}
                    >
                        +₹{diseaseCost.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Step 3: Total */}
            <div className="flex items-center mt-4 border-t border-slate-100 pt-4">
                <div className="w-24 text-xs font-bold text-slate-800 text-right mr-4">Total Cost</div>
                <div className="flex-grow bg-green-100 rounded-full h-10 relative">
                    <div className="bg-green-600 h-full rounded-full w-full flex items-center justify-end pr-4 text-white text-sm font-bold">
                        ₹{finalCost.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureImpactTab({ shapValues }) {
    if (!shapValues) return <div className="p-4 text-sm text-slate-400">No feature data available.</div>;

    // Sort by absolute impact
    const sorted = [...shapValues].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return (
        <div className="space-y-3 p-2">
            {sorted.map((item, idx) => {
                const impact = item.amount;
                return (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded shadow-sm">
                        <div>
                            <div className="text-xs font-bold text-slate-700">{item.label}</div>
                            <div className="text-[10px] text-slate-400">Primary Model Driver #{idx + 1}</div>
                        </div>
                        <div className={`text-sm font-mono font-bold ${impact > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {impact > 0 ? '+' : ''}₹{Math.abs(impact).toLocaleString()}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default function Section4Explainability({ result, form, onWhatIfUpdate }) {
    const [activeTab, setActiveTab] = useState('impact');

    // Enforce visual dominance as requested
    return (
        <div className="bg-slate-50 rounded-xl shadow-lg border border-slate-200 mb-6 flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="bg-slate-800 text-white p-4 rounded-t-xl flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold">Why this cost? — Explainable AI</h3>
                    <p className="text-xs text-slate-300">Post-hoc explanation layer</p>
                </div>
                <div className="flex bg-slate-700 rounded p-1">
                    <button
                        onClick={() => setActiveTab('impact')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'impact' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}
                    >
                        Feature Impact
                    </button>
                    <button
                        onClick={() => setActiveTab('disease')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'disease' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}
                    >
                        Disease Breakdown
                    </button>
                    <button
                        onClick={() => setActiveTab('whatif')}
                        className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'whatif' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}
                    >
                        What-if Simulator
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow p-6 bg-white rounded-b-xl border-x border-b border-slate-200">
                {activeTab === 'impact' && (
                    <FeatureImpactTab shapValues={result.baseline.shap_values} />
                )}

                {activeTab === 'disease' && (
                    <WaterfallFallback
                        baseline={result.baseline}
                        final={result.final_estimate}
                        episode={result.episode}
                    />
                )}

                {activeTab === 'whatif' && (
                    <div className="h-full">
                        <WhatIfSimulator
                            baselineInputs={form}
                            baselinePrediction={result.final_estimate}
                            onClose={() => setActiveTab('impact')}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
