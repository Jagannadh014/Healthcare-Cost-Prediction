import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import clsx from 'clsx'

export default function PredictionHistory({ onSelectPrediction, selectedPredictionId }) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const fetchHistory = async (isManual = false) => {
        if (isManual) setRefreshing(true)
        try {
            const res = await axios.get('http://localhost:5000/predictions/history')
            setHistory(res.data)
            if (isManual) toast.success('History updated')
        } catch (err) {
            console.error(err)
            toast.error('Failed to load history')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        fetchHistory()

        // Poll for updates every 30 seconds to keep feedback status fresh
        const interval = setInterval(fetchHistory, 30000)
        return () => clearInterval(interval)
    }, [])

    // Expose refresh function to parent if needed, but for now auto-refresh logic
    // or parent triggering refresh via key change is enough.
    // Actually, let's export a refresh trigger?
    // Simpler: Just refresh on mount or when receiving a signal.
    // For MVP, polling or manual refresh is fine.

    if (loading) return <div className="p-4 text-gray-400 text-sm">Loading history...</div>

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-700">Recent Predictions</h3>
                <button
                    onClick={() => fetchHistory(true)}
                    disabled={refreshing}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                >
                    {refreshing && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No predictions yet.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                            <tr>
                                <th className="p-3 font-normal">Date</th>
                                <th className="p-3 font-normal">Predicted ($)</th>
                                <th className="p-3 font-normal">Profile</th>
                                <th className="p-3 font-normal text-right">Status</th>
                                <th className="p-3 font-normal text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {history.map((item) => (
                                <tr
                                    key={item.prediction_id}
                                    className={clsx(
                                        "hover:bg-blue-50 transition-colors",
                                        selectedPredictionId === item.prediction_id && "bg-blue-100"
                                    )}
                                >
                                    <td className="p-3 text-gray-600">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 font-semibold text-gray-800">
                                        ${item.predicted_cost.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-xs text-gray-500">
                                        {item.input_summary}
                                    </td>
                                    <td className="p-3 text-right">
                                        {item.feedback_given ? (
                                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                Submitted
                                            </span>
                                        ) : (
                                            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                                                Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => onSelectPrediction(item)}
                                            className={clsx(
                                                "px-3 py-1 text-xs rounded border transition-colors",
                                                selectedPredictionId === item.prediction_id
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                                            )}
                                        >
                                            {selectedPredictionId === item.prediction_id ? 'Selected' : 'Select'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
