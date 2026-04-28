import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function FeedbackForm({ selectedPrediction, onFeedbackSuccess }) {
    const [actualCost, setActualCost] = useState('')
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)

    // Reset form when selection changes
    useEffect(() => {
        if (selectedPrediction && !selectedPrediction.feedback_given) {
            setActualCost('')
            setNote('')
        }
    }, [selectedPrediction])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!selectedPrediction) return

        if (!actualCost || Number(actualCost) < 0) {
            toast.error('Please enter a valid actual cost (≥ 0)')
            return
        }

        setLoading(true)
        try {
            const res = await axios.post('http://localhost:5000/feedback', {
                prediction_id: selectedPrediction.prediction_id,
                actual_cost: Number(actualCost),
                feedback_note: note
            })

            toast.success(res.data.message || 'Feedback submitted successfully!')

            // Notify parent to refresh history
            if (onFeedbackSuccess) onFeedbackSuccess(Number(actualCost))

        } catch (err) {
            const errorMsg = err?.response?.data?.error || err.message
            toast.error('Feedback submission failed: ' + errorMsg)
        } finally {
            setLoading(false)
        }
    }

    if (!selectedPrediction) {
        return (
            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                <div className="mb-2 text-2xl">📋</div>
                Select a prediction from the history above<br />to submit feedback.
            </div>
        )
    }

    // Read-only mode if feedback already given
    if (selectedPrediction.feedback_given) {
        return (
            <div className="p-6 rounded-xl border border-green-100 bg-green-50/50">
                <div className="flex items-center gap-2 mb-3 text-green-800 font-medium">
                    <span className="text-xl">✓</span> Feedback Submitted
                </div>
                <p className="text-sm text-gray-600 mb-2">
                    Start Date: <strong>{new Date(selectedPrediction.created_at).toLocaleDateString()}</strong>
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4 bg-white p-4 rounded-lg border border-green-100">
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Predicted</div>
                        <div className="text-lg font-semibold text-gray-800">
                            ${selectedPrediction.predicted_cost.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Actual</div>
                        <div className="text-lg font-semibold text-teal-700">
                            {selectedPrediction.actual_cost
                                ? `$${Number(selectedPrediction.actual_cost).toLocaleString()}`
                                : '—'}
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-xs text-center text-gray-500">
                    Thank you for helping improve the model!
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 rounded-xl border border-gray-100 bg-white shadow-sm">
            <h2 className="text-lg font-medium mb-1">Submit Actual Cost</h2>
            <div className="text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded flex justify-between items-center">
                <span>For Prediction <code className="text-xs bg-gray-200 px-1 rounded">{selectedPrediction.prediction_id.slice(0, 8)}...</code></span>
                <span className="font-semibold text-gray-700">Est: ${selectedPrediction.predicted_cost.toLocaleString()}</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm text-gray-600 mb-1 block">
                        Actual Bill Amount ($)
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        placeholder="E.g. 25000"
                        className="w-full p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-600 mb-1 block">
                        Notes (Optional)
                    </label>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="E.g. Hospitalized for viral fever"
                        className="w-full p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    className={clsx(
                        "w-full bg-accent-600 text-black px-5 py-3 rounded-md shadow flex justify-center items-center gap-2 hover:bg-accent-700 transition-colors font-medium",
                        loading && "opacity-60 cursor-not-allowed"
                    )}
                    disabled={loading}
                >
                    {loading ? 'Submitting...' : 'Confirm & Submit'}
                </motion.button>
            </form>
        </div>
    )
}
