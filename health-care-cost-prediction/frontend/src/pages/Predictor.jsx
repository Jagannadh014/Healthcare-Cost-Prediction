
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Field from '../components/Field'
import Skeleton from '../components/Skeleton'
import WhatIfSimulator from '../components/WhatIfSimulator'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import Section1Summary from '../components/Predictor/Section1Summary'
import Section2Baseline from '../components/Predictor/Section2Baseline'
import Section3Episode from '../components/Predictor/Section3Episode'
import Section4Explainability from '../components/Predictor/Section4Explainability'

import Section6Guidance from '../components/Predictor/Section6Guidance'
import Section5Uncertainty from '../components/Predictor/Section5Uncertainty'

const DISEASES = [
  "Heart Disease", "Diabetes", "Fractured Arm", "Stroke", "Cancer",
  "Hypertension", "Appendicitis", "Fractured Leg", "Heart Attack",
  "Allergic Reaction", "Respiratory Infection", "Prostate Cancer",
  "Childbirth", "Kidney Stones", "Osteoarthritis"
];

export default function Predictor() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    age: '',
    sex: '',
    bmi: '',
    children: '',
    smoker: '',
    region: '',
    hasCondition: false,
    condition: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showSimulator, setShowSimulator] = useState(false)
  const [showBmiCalc, setShowBmiCalc] = useState(false)
  const [bmiInputs, setBmiInputs] = useState({ height: '', weight: '' })
  const [bmiResult, setBmiResult] = useState(null)
  const [loadingGuidance, setLoadingGuidance] = useState(false)
  const [guidance, setGuidance] = useState(null)

  const fetchGuidance = async (condition) => {
    if (!condition) {
      setGuidance(null);
      return;
    }
    setLoadingGuidance(true);
    try {
      // Normalize ID: "Hypertension" -> "hypertension"
      const id = condition.toLowerCase().replace(/ /g, '-');
      const res = await axios.get(`http://localhost:5000/guidance/${id}`);
      setGuidance(res.data);
    } catch (err) {
      console.log("No guidance found for", condition);
      setGuidance(null);
    } finally {
      setLoadingGuidance(false);
    }
  }

  const handle = (k, v) => setForm(prev => {
    // If turning off condition, clear the disease selection
    if (k === 'hasCondition' && v === false) {
      return { ...prev, [k]: v, condition: '' }
    }
    return { ...prev, [k]: v }
  })

  const validate = () => {
    let e = {}
    if (form.age === '' || Number(form.age) < 0) e.age = 'Age must be ≥ 0'
    if (form.bmi === '' || Number(form.bmi) < 0) e.bmi = 'BMI must be ≥ 0'
    if (form.children === '' || Number(form.children) < 0)
      e.children = 'Children must be ≥ 0'
    if (!form.sex) e.sex = 'Select sex'
    if (!form.smoker) e.smoker = 'Select smoker'
    if (!form.region) e.region = 'Select region'

    if (form.hasCondition && !form.condition) {
      e.condition = 'Please select a condition'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const calculateBMI = () => {
    const h = Number(bmiInputs.height)
    const w = Number(bmiInputs.weight)

    if (!h || h <= 0 || !w || w <= 0) {
      toast.error('Please enter valid positive height and weight')
      return
    }

    // Convert cm to m if height > 3 (heuristic)
    const heightInMeters = h > 3 ? h / 100 : h

    const bmiVal = w / (heightInMeters * heightInMeters)
    const bmiRounded = parseFloat(bmiVal.toFixed(2))

    let category = ''
    if (bmiRounded < 18.5) category = 'Underweight'
    else if (bmiRounded < 25) category = 'Normal'
    else if (bmiRounded < 30) category = 'Overweight'
    else category = 'Obese'

    setBmiResult({ value: bmiRounded, category })
    handle('bmi', bmiRounded) // Auto-fill main form
    setErrors(prev => ({ ...prev, bmi: null })) // Clear BMI error if any
  }

  const submit = async e => {
    e.preventDefault()
    setResult(null)

    if (!validate()) {
      toast.error('Please fix validation errors')
      return
    }

    setLoading(true)
    setGuidance(null)
    try {
      const payload = {
        age: Number(form.age),
        bmi: Number(form.bmi),
        children: Number(form.children),
        sex: form.sex,
        smoker: form.smoker,
        region: form.region,
        condition: form.hasCondition ? form.condition : undefined
      }

      const predictPromise = axios.post(
        'http://localhost:5000/predict',
        payload,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('healthcare_token')}` },
          timeout: 60000
        }
      );

      const guidancePromise = form.hasCondition ? fetchGuidance(form.condition) : Promise.resolve(null);

      const [res] = await Promise.all([predictPromise, guidancePromise]);

      setResult(res.data)
      if (!res.data?.error) toast.success('Prediction ready')
      else toast.error(res.data.error)
    } catch (err) {
      toast.error(
        'Prediction error: ' +
        (err?.response?.data?.error || err.message)
      )
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ---------------- INPUT CARD ---------------- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-white/80 backdrop-blur-lg border border-white/50 shadow-xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-display font-semibold text-slate-800">New Prediction</h2>
            <p className="text-sm text-slate-500">Enter patient details to estimate costs</p>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
            <span className="text-xs font-medium">Predicting for:</span>
            <span className="text-sm font-bold">{user?.email?.split('@')[0]}</span>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={submit} className="space-y-8">
            {/* Section 1: Demographics */}
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-l-4 border-primary-500 pl-3">Baseline Demographics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Field
                  label="Age"
                  type="number"
                  min={0}
                  max={120}
                  value={form.age}
                  onChange={v => handle('age', v)}
                  error={errors.age}
                />
                <Field
                  label="Sex"
                  type="select"
                  value={form.sex}
                  onChange={v => handle('sex', v)}
                  options={['male', 'female']}
                  error={errors.sex}
                />
                <Field
                  label="Children"
                  type="number"
                  min={0}
                  max={10}
                  value={form.children}
                  onChange={v => handle('children', v)}
                  error={errors.children}
                />

                <div className="lg:col-span-1">
                  <Field
                    label="BMI"
                    type="number"
                    min={10}
                    max={60}
                    step="0.1"
                    value={form.bmi}
                    onChange={v => handle('bmi', v)}
                    error={errors.bmi}
                  />
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => setShowBmiCalc(!showBmiCalc)} className="text-xs font-medium text-primary-600 hover:underline">
                      {showBmiCalc ? 'Close Calculator' : "Calculate BMI"}
                    </button>
                  </div>
                </div>

                {/* BMI Calculator */}
                {showBmiCalc && (
                  <div className="col-span-full bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-inner mb-2">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">BMI Helper</h4>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-500 block">Height (cm)</label>
                        <input type="number" className="input-primary py-2 text-sm w-full" value={bmiInputs.height} onChange={e => setBmiInputs(prev => ({ ...prev, height: e.target.value }))} />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-500 block">Weight (kg)</label>
                        <input type="number" className="input-primary py-2 text-sm w-full" value={bmiInputs.weight} onChange={e => setBmiInputs(prev => ({ ...prev, weight: e.target.value }))} />
                      </div>
                      <button type="button" onClick={calculateBMI} className="btn btn-primary py-2 text-sm">Use</button>
                    </div>
                  </div>
                )}

                <Field label="Smoker" type="select" value={form.smoker} onChange={v => handle('smoker', v)} options={['yes', 'no']} error={errors.smoker} />
                <Field label="Region" type="select" value={form.region} onChange={v => handle('region', v)} options={['southeast', 'southwest', 'northwest', 'northeast']} error={errors.region} />
              </div>
            </div>

            {/* Section 2: Clinical Episode */}
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-l-4 border-accent-500 pl-3">Clinical Condition (Optional)</h3>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasCondition}
                    onChange={e => handle('hasCondition', e.target.checked)}
                    className="form-checkbox h-5 w-5 text-accent-600 rounded border-gray-300 focus:ring-accent-500"
                  />
                  <span className="text-slate-700 font-medium select-none">I have a diagnosed condition or planned treatment</span>
                </label>

                {form.hasCondition && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pl-8"
                  >
                    <div className="max-w-md">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Condition</label>
                      <select
                        value={form.condition}
                        onChange={e => handle('condition', e.target.value)}
                        className={clsx("input-primary", errors.condition && "border-red-500 focus:ring-red-500")}
                      >
                        <option value="">-- Choose a Disease --</option>
                        {DISEASES.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {errors.condition && <p className="text-xs text-red-600 mt-1">{errors.condition}</p>}
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-bold">Note:</span> Procedure details will be automatically determined based on standard clinical protocols.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>


            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => {
                  setForm({ age: '', sex: '', bmi: '', children: '', smoker: '', region: '', hasCondition: false, condition: '' })
                  setErrors({})
                  setResult(null)
                }}
              >
                Clear Form
              </button>
              <motion.button type="submit" whileTap={{ scale: 0.98 }} className="btn bg-primary-600 text-black hover:bg-primary-700 shadow-lg min-w-[200px]" disabled={loading}>
                {loading ? 'Processing...' : 'Generate Estimate'}
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* ---------------- RESULTS (Redesigned Layered View) ---------------- */}
      {loading && (
        <div className="card text-center py-12">
          <Skeleton rows={1} />
          <p className="text-slate-500 mt-4 animate-pulse">Running layered actuarial analysis...</p>
        </div>
      )}

      {result && result.final_estimate && (
        <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">

          {/* Section 1: Orientation */}
          <Section1Summary finalEstimate={result.final_estimate} />

          {/* Section 2: Baseline (ML-Driven) */}
          <Section2Baseline baseline={result.baseline} />

          {/* Section 3: Episode (Rule-Guided) */}
          <Section3Episode
            episode={result.episode}
            conditionName={form.condition}
            finalRange={result.final_estimate?.range}
          />

          {/* Section 5: Uncertainty & Reliability */}
          <Section5Uncertainty
            finalEstimate={result.final_estimate}
            conditionName={form.condition}
          />

          {/* Section 4: Explainability (Dominant) */}
          <Section4Explainability
            result={result}
            form={form}
          />



          {/* Section 6: Medical Guidance (Offline Curated) */}
          <Section6Guidance
            guidance={guidance}
            loading={loadingGuidance}
          />

        </motion.div>
      )}

    </div>
  )
}
