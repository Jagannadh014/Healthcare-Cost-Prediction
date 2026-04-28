import React from 'react'

export default function Skeleton({ rows=3 }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} className="h-6 bg-gray-200 rounded-md w-full"></div>
      ))}
    </div>
  )
}
