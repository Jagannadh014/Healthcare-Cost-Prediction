import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Skeleton from '../components/Skeleton'

export default function Metrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetchMetrics() {
      try {
        const res = await axios.get('http://localhost:5000/metrics', { timeout: 8000 })
        if (!mounted) return
        setMetrics(res.data)
      } catch (e) {
        setMetrics({ error: 'Could not fetch metrics. Backend may be offline.' })
      } finally { if (mounted) setLoading(false) }
    }
    fetchMetrics()
    return () => mounted = false
  }, [])

  return (
    <div className="p-6 rounded-xl border border-gray-100 bg-white">
      <h2 className="text-lg font-medium mb-3">Model Metrics</h2>
      {loading ? <Skeleton rows={4} /> :
        metrics ? (
          metrics.error ? <div className="text-sm text-red-600">{metrics.error}</div> : (
            <div className="space-y-3">
              <div className="text-sm text-gray-500">
                Detailed technical metrics are available in the Admin Portal.
              </div>
            </div>
          )
        ) : null
      }
    </div>
  )
}
