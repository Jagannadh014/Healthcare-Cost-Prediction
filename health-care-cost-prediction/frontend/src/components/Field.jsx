import React from 'react'
import clsx from 'clsx'

export default function Field({
  label,
  type,
  value,
  onChange,
  options = [],
  error,
  min,
  max,
  step
}) {
  return (
    <div className="field-wrap w-full">
      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">
        {label}
      </label>

      {type === 'select' ? (
        <div className="relative">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={clsx(
              "input-primary appearance-none cursor-pointer",
              error && "border-red-400 focus:border-red-500 focus:ring-red-500/20"
            )}
          >
            <option value="">Select an option...</option>
            {options.map(o => (
              <option key={o} value={o}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      ) : (
        <input
          type="number"
          min={min ?? 0}
          max={max}
          step={step ?? "1"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={label}
          className={clsx(
            "input-primary",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/20"
          )}
        />
      )}

      {/* Validation text */}
      <div className="min-h-[20px] mt-1 pl-1">
        {error ? (
          <p className="text-xs font-medium text-red-500 flex items-center animate-fade-in">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
