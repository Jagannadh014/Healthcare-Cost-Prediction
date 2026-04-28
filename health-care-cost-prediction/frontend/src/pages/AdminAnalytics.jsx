import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Skeleton from '../components/Skeleton'
import { toast } from 'react-toastify'

export default function AdminAnalytics() {
    const [errorMetrics, setErrorMetrics] = useState(null)
    const [biasData, setBiasData] = useState(null)
    const [loading, setLoading] = useState(true)
    const { logout, user } = useAuth()
    const navigate = useNavigate()

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

    const exportTrainingData = async () => {
        try {
            const res = await axios.get('http://localhost:5000/export/training-data', {
                responseType: 'blob'
            })

            // Create download link
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'training_data.csv')
            document.body.appendChild(link)
            link.click()
            link.remove()

            toast.success('Training data exported successfully!')
        } catch (err) {
            toast.error('Export failed: ' + (err?.response?.data?.error || err.message))
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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Admin Header */}
            <header className="bg-gray-900 text-white p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate('/admin/dashboard')}
                    >
                        <div className="bg-teal-500 w-8 h-8 rounded flex items-center justify-center font-bold">A</div>
                        <h1 className="text-lg font-semibold tracking-wide">Admin Portal</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">Logged in as {user?.email}</span>
                        <button
                            onClick={() => { logout(); navigate('/admin/login') }}
                            className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto w-full p-6 flex-grow">
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="text-sm text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1"
                    >
                        ← Back to Dashboard
                    </button>
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Analytics & Bias Monitoring</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Track system performance and detect fairness issues.
                            </p>
                        </div>
                        <button
                            onClick={exportTrainingData}
                            className="bg-accent text-white px-4 py-2 rounded-md shadow hover:bg-teal-600 transition flex items-center gap-2"
                        >
                            <span>⬇️</span> Export Training Data
                        </button>
                    </div>
                </div>

                {loading ? (
                    <Skeleton rows={8} />
                ) : (
                    <div className="space-y-6">
                        {/* Overall Error Metrics */}
                        <div className="p-6 rounded-xl border border-gray-100 bg-white shadow-sm">
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
                        <div className="p-6 rounded-xl border border-gray-100 bg-white shadow-sm">
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
                    </div>
                )}
            </main>
        </div>
    )
}
