import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function WhatIfSimulator({ baselineInputs, baselinePrediction, onClose }) {
    const [modifiedInputs, setModifiedInputs] = useState({ ...baselineInputs })
    const [simulation, setSimulation] = useState(null)
    const [loading, setLoading] = useState(false)
    const [debounceTimer, setDebounceTimer] = useState(null)

    // Debounced simulation call
    const runSimulation = async (inputs) => {
        setLoading(true)
        try {
            const res = await axios.post('http://localhost:5000/what-if', {
                baseline_inputs: baselineInputs,
                modified_inputs: inputs
            })
            setSimulation(res.data)
        } catch (err) {
            toast.error('Simulation error: ' + (err?.response?.data?.error || err.message))
        } finally {
            setLoading(false)
        }
    }

    // Handle input changes with debouncing
    const handleChange = (field, value) => {
        const newInputs = { ...modifiedInputs, [field]: value }
        setModifiedInputs(newInputs)

        // Clear existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer)
        }

        // Set new timer (300ms debounce)
        const timer = setTimeout(() => {
            runSimulation(newInputs)
        }, 300)

        setDebounceTimer(timer)
    }

    // Initial simulation on mount
    useEffect(() => {
        runSimulation(baselineInputs)
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
        }
    }, [])

    const getDifferenceColor = (diff) => {
        if (diff < 0) return 'text-green-600'
        if (diff > 0) return 'text-red-600'
        return 'text-gray-600'
    }

    const getDifferenceIcon = (diff) => {
        if (diff < 0) return '↓'
        if (diff > 0) return '↑'
        return '='
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl border-2 border-blue-200"
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-800">What-If Simulator</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Adjust controllable factors to see cost impact
                    </p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Controls */}
                <div className="space-y-6">
                    {/* Group 1: Actionable Lifestyle Changes */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-teal-500">
                        <h4 className="font-bold text-teal-800 mb-4 flex items-center gap-2">
                            <span>✨</span> Actionable Lifestyle Changes
                        </h4>

                        {/* BMI Slider */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-gray-700">Target BMI</label>
                                <span className="text-lg font-bold text-teal-600">{modifiedInputs.bmi}</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="60"
                                step="0.5"
                                value={modifiedInputs.bmi}
                                onChange={(e) => handleChange('bmi', parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>10</span>
                                <span className="text-gray-400">Underweight | Normal | Overweight | Obese</span>
                                <span>60</span>
                            </div>
                        </div>

                        {/* Smoker Toggle */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-3 block">Smoker Status</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleChange('smoker', 'yes')}
                                    className={clsx(
                                        'flex-1 py-3 px-4 rounded-lg font-medium transition',
                                        modifiedInputs.smoker === 'yes'
                                            ? 'bg-red-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    )}
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => handleChange('smoker', 'no')}
                                    className={clsx(
                                        'flex-1 py-3 px-4 rounded-lg font-medium transition',
                                        modifiedInputs.smoker === 'no'
                                            ? 'bg-green-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    )}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Group 2: Contextual Factors (Non-Modifiable) */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 opacity-90">
                        <h4 className="font-semibold text-slate-600 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                            <span>🔒</span> Contextual Factors (Sensitivity Only)
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Children (Moved here, Read-Only) */}
                            <div className="col-span-2 bg-white p-3 rounded border border-slate-200 relative group">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Number of Children</label>
                                <div className="text-lg font-bold text-slate-700">{baselineInputs.children}</div>

                                <div className="mt-1 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100 flex gap-1.5 items-start">
                                    <span className="mt-0.5">ℹ️</span>
                                    <span>
                                        This factor influences cost but cannot be changed as a real-world intervention.
                                        Shown for sensitivity understanding only.
                                    </span>
                                </div>
                            </div>

                            {/* Standard Read-Only Fields */}
                            <div className="bg-slate-100 p-2 rounded">
                                <div className="text-xs text-slate-500">Age</div>
                                <div className="font-semibold text-slate-700">{baselineInputs.age}</div>
                            </div>
                            <div className="bg-slate-100 p-2 rounded">
                                <div className="text-xs text-slate-500">Sex</div>
                                <div className="font-semibold text-slate-700 capitalize">{baselineInputs.sex}</div>
                            </div>
                            <div className="col-span-2 bg-slate-100 p-2 rounded">
                                <div className="text-xs text-slate-500">Region</div>
                                <div className="font-semibold text-slate-700 capitalize">{baselineInputs.region}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="space-y-6">
                    {/* Cost Comparison */}
                    <div className="bg-white p-5 rounded-lg shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4">Cost Comparison</h4>

                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto"></div>
                                <p className="text-sm text-gray-500 mt-3">Simulating...</p>
                            </div>
                        ) : simulation ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b">
                                    <span className="text-sm text-gray-600">Baseline Cost:</span>
                                    <span className="text-lg font-semibold text-gray-800">
                                        ${simulation.baseline_cost.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b">
                                    <span className="text-sm text-gray-600">Simulated Cost:</span>
                                    <span className="text-lg font-semibold text-gray-800">
                                        ${simulation.simulated_cost.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-sm font-medium text-gray-700">Difference:</span>
                                    <div className="text-right">
                                        <div className={clsx('text-2xl font-bold', getDifferenceColor(simulation.difference))}>
                                            {getDifferenceIcon(simulation.difference)} ${Math.abs(simulation.difference).toLocaleString()}
                                        </div>
                                        <div className={clsx('text-sm', getDifferenceColor(simulation.difference))}>
                                            ({simulation.percentage_change > 0 ? '+' : ''}{simulation.percentage_change}%)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Counterfactual Recommendation */}
                    {simulation && simulation.counterfactual && (
                        <div className="bg-blue-50 p-5 rounded-lg border-2 border-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="text-3xl">💡</div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-blue-900 mb-2">Recommended Action</h4>
                                    <div className="text-lg font-bold text-blue-800 mb-1">
                                        {simulation.counterfactual.change}
                                    </div>
                                    {simulation.counterfactual.expected_savings > 0 && (
                                        <div className="text-sm font-semibold text-green-700 mb-3">
                                            💰 Save ${simulation.counterfactual.expected_savings.toLocaleString()}/year
                                        </div>
                                    )}
                                    <p className="text-sm text-blue-700 leading-relaxed">
                                        {simulation.counterfactual.explanation}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
