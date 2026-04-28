import React, { useState } from 'react'
import PredictionHistory from '../components/PredictionHistory'
import FeedbackForm from '../components/FeedbackForm'

export default function Feedback() {
    const [selectedPrediction, setSelectedPrediction] = useState(null)
    const [historyKey, setHistoryKey] = useState(0)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: History Selection */}
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a Prediction</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Choose a past prediction to report the actual cost. This helps the AI learn.
                    </p>
                    <PredictionHistory
                        key={historyKey}
                        onSelectPrediction={setSelectedPrediction}
                        selectedPredictionId={selectedPrediction?.prediction_id}
                    />
                </div>
            </div>

            {/* RIGHT COLUMN: Feedback Form */}
            <div className="space-y-4">
                <div className="relative">
                    {selectedPrediction && (
                        <div className="absolute -top-3 left-4 bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm z-10">
                            Selected
                        </div>
                    )}
                    <FeedbackForm
                        selectedPrediction={selectedPrediction}
                        onFeedbackSuccess={(cost) => {
                            setHistoryKey(prev => prev + 1)
                            setSelectedPrediction(prev => ({
                                ...prev,
                                feedback_given: true,
                                actual_cost: cost
                            }))
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
