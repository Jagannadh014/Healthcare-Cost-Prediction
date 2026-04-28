import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Skeleton from '../components/Skeleton'
import { toast } from 'react-toastify'

import { useAuth } from '../context/AuthContext'

export default function Analytics() {
    const { user } = useAuth()
    const [errorMetrics, setErrorMetrics] = useState(null)
    const [biasData, setBiasData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const [errorsRes, biasRes] = await Promise.all([
                axios.get('http://localhost:5000/analytics/errors'),
                axios.get('http://localhost:5000/analytics/bias')
            ])
            setErrorMetrics(errorsRes.data)
            setBiasData(biasRes.data)
        } catch (err) {
            toast.error('Failed to load analytics: ' + (err?.response?.data?.error || err.message))
        } finally {
            setLoading(false)
        }
    }

    const handleExport = async () => {
        try {
            const response = await axios.get('http://localhost:5000/export/training-data', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `training_data_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Data exported successfully');
        } catch (err) {
            toast.error('Export failed: ' + (err.response?.data?.error || "Access Denied"));
        }
    }

    const renderBiasTable = (title, data) => {
        if (!data) return null

        const entries = Object.entries(data).filter(([_, stats]) => stats !== null)
        if (entries.length === 0) {
            return (
                <div className="text-sm text-gray-500">No data available for {title}</div>
            )
        }

        return (
            <div className="mb-6">
                <h3 className="text-md font-semibold mb-3">{title}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 text-left border">Group</th>
                                <th className="p-2 text-right border">Count</th>
                                <th className="p-2 text-right border">Mean Error ($)</th>
                                <th className="p-2 text-right border">Mean Abs Error ($)</th>
                                <th className="p-2 text-left border">Bias Direction</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(([group, stats]) => (
                                <tr key={group} className="hover:bg-gray-50">
                                    <td className="p-2 border font-medium">{group}</td>
                                    <td className="p-2 border text-right">{stats.count}</td>
                                    <td className={`p-2 border text-right font-semibold ${stats.mean_error > 0 ? 'text-red-600' : stats.mean_error < 0 ? 'text-green-600' : 'text-gray-600'
                                        }`}>
                                        {stats.mean_error > 0 ? '+' : ''}{stats.mean_error.toFixed(2)}
                                    </td>
                                    <td className="p-2 border text-right">{stats.mean_absolute_error.toFixed(2)}</td>
                                    <td className="p-2 border">
                                        <span className={`px-2 py-1 rounded text-xs ${stats.bias_direction === 'underprediction'
                                            ? 'bg-red-100 text-red-700'
                                            : stats.bias_direction === 'overprediction'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {stats.bias_direction}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold">Analytics & Bias Monitoring</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Track prediction accuracy and detect systematic bias across demographic groups
                    </p>
                </div>
                {user?.role === 'admin' && (
                    <button
                        onClick={handleExport}
                        className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Export Training Data
                    </button>
                )}
            </div>

            {loading ? (
                <Skeleton rows={8} />
            ) : (
                <>
                    {/* Overall Error Metrics */}
                    <div className="p-6 rounded-xl border border-gray-100 bg-white">
                        <h3 className="text-lg font-medium mb-4">Overall Error Metrics</h3>

                        {errorMetrics?.message ? (
                            <div className="text-sm text-gray-500">{errorMetrics.message}</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                    <div className="text-xs text-blue-600 mb-1">Total Feedback</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {errorMetrics?.total_feedback_count || 0}
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                                    <div className="text-xs text-orange-600 mb-1">Mean Absolute Error</div>
                                    <div className="text-2xl font-bold text-orange-700">
                                        $ {errorMetrics?.mean_absolute_error?.toFixed(2) || '0.00'}
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                                    <div className="text-xs text-purple-600 mb-1">Median Absolute Error</div>
                                    <div className="text-2xl font-bold text-purple-700">
                                        $ {errorMetrics?.median_absolute_error?.toFixed(2) || '0.00'}
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-pink-50 border border-pink-200">
                                    <div className="text-xs text-pink-600 mb-1">Mean Percentage Error</div>
                                    <div className="text-2xl font-bold text-pink-700">
                                        {errorMetrics?.mean_percentage_error?.toFixed(2) || '0.00'}%
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bias Monitoring */}
                    <div className="p-6 rounded-xl border border-gray-100 bg-white">
                        <h3 className="text-lg font-medium mb-4">Bias Monitoring by Groups</h3>

                        {biasData?.message ? (
                            <div className="text-sm text-gray-500">{biasData.message}</div>
                        ) : (
                            <div className="space-y-6">
                                {renderBiasTable('By Smoker Status', biasData?.by_smoker)}
                                {renderBiasTable('By Age Band', biasData?.by_age_band)}
                                {renderBiasTable('By BMI Category', biasData?.by_bmi_category)}
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                        <div className="font-semibold mb-2">Understanding Bias Direction:</div>
                        <ul className="space-y-1 text-gray-700">
                            <li><span className="font-medium text-red-600">Underprediction:</span> Model predicts lower costs than actual (positive mean error)</li>
                            <li><span className="font-medium text-green-600">Overprediction:</span> Model predicts higher costs than actual (negative mean error)</li>
                            <li><span className="font-medium text-gray-600">Neutral:</span> Predictions are balanced on average</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    )
}
