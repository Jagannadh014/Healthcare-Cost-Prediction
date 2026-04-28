import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Skeleton from '../components/Skeleton'

export default function AdminUserDetail({ userIdProp }) {
    const { userId: paramId } = useParams()
    const userId = userIdProp || paramId
    const [predictions, setPredictions] = useState([])
    const [loading, setLoading] = useState(true)
    const { logout } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        fetchPredictions()
    }, [userId])

    const fetchPredictions = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/admin/users/${userId}/predictions`)
            setPredictions(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Admin Header (Reused for simplicity, componentizing would be better but keeping simple for MVP) */}
            <header className="bg-gray-900 text-white p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                        <div className="bg-teal-500 w-8 h-8 rounded flex items-center justify-center font-bold">A</div>
                        <h1 className="text-lg font-semibold tracking-wide">Admin Portal</h1>
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/admin/login') }}
                        className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-sm transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto w-full p-6 flex-grow">
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="text-sm text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1"
                    >
                        ← Back to User List
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        User Activity
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {userId}
                        </span>
                    </h2>
                </div>

                {loading ? <Skeleton rows={5} /> : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 font-medium text-gray-700">
                            Recent Predictions ({predictions.length})
                        </div>

                        {predictions.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                This user has not made any predictions yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {predictions.map(pred => (
                                    <div key={pred.prediction_id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                                                    {new Date(pred.createdAt).toLocaleString()}
                                                </div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    ${pred.prediction.toLocaleString()}
                                                </div>
                                            </div>

                                            {/* Uncertainty Badge */}
                                            {pred.uncertainty?.uncertainty_level && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${pred.uncertainty.uncertainty_level === 'low' ? 'bg-green-100 text-green-700' :
                                                    pred.uncertainty.uncertainty_level === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {pred.uncertainty.uncertainty_level.toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Inputs Summary */}
                                        <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 bg-gray-50 p-2 rounded">
                                            <div><span className="text-gray-400 text-xs block">Age</span>{pred.input?.age}</div>
                                            <div><span className="text-gray-400 text-xs block">BMI</span>{pred.input?.bmi}</div>
                                            <div><span className="text-gray-400 text-xs block">Smoker</span>{pred.input?.smoker}</div>
                                            <div><span className="text-gray-400 text-xs block">Region</span>{pred.input?.region}</div>
                                        </div>

                                        {/* Feedback if any */}
                                        {pred.feedback && pred.feedback.actual_cost && (
                                            <div className="text-sm mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-green-600 font-medium text-xs border border-green-200 bg-green-50 px-1 rounded">FEEDBACK GIVEN</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-gray-700">
                                                    <div>Act: <strong>${pred.feedback.actual_cost}</strong></div>
                                                    <div>Err: <strong className="text-orange-600">{pred.feedback.percentage_error?.toFixed(1)}%</strong></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-xs text-gray-400 mt-2 font-mono">
                                            ID: {pred.prediction_id}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
