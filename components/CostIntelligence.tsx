'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const SURFACE = '#0c1322'
const SURFACE2 = '#111927'
const BORDER = '#1c2535'
const BORDER2 = '#243045'
const GOLD = '#c9a842'
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const TEXT = '#dde2ed'
const TEXT2 = '#8e9ab5'
const TEXT3 = '#4a5570'
const FONT = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 })

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
}

export default function CostIntelligence() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [starlingTxns, setStarlingTxns] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: txns }, { data: starling }, { data: props }] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('starling_transactions').select('*'),
        supabase.from('properties_master').select('*').order('property_id'),
      ])
      if (txns) setTransactions(txns)
      if (starling) setStarlingTxns(starling)
      if (props) setProperties(props)
      setLoading(false)
    }
    load()
  }, [])

  const { benchmarkGrid, categories, anomalies, supplierTable, savings } = useMemo(() => {
    // Exclude rent — only costs
    const costTxns = transactions.filter(t => t['Item type'] !== 'Rent Paid')

    // Get unique categories and properties
    const categories = Array.from(new Set(costTxns.map(t => t['Item type']).filter(Boolean))).sort()

    // Build property × category totals
    const propCatTotals: Record<string, Record<string, number>> = {}
    for (const p of properties) {
      propCatTotals[p.property_id] = {}
      const addrKey = (p.address || '').split(',')[0].trim().toLowerCase()
      for (const t of costTxns) {
        const tAddr = String(t['Property address'] || '').toLowerCase()
        if (tAddr.includes(addrKey)) {
          const cat = t['Item type'] || 'Other'
          propCatTotals[p.property_id][cat] = (propCatTotals[p.property_id][cat] || 0) + Math.abs(Number(t['Item amount inc VAT'] || 0))
        }
      }
    }

    // Compute medians per category
    const catMedians: Record<string, number> = {}
    for (const cat of categories) {
      const vals = properties.map(p => propCatTotals[p.property_id]?.[cat] || 0).filter(v => v > 0)
      catMedians[cat] = median(vals)
    }

    // Anomaly detection: transactions > 2σ above mean for (type, property)
    const buckets: Record<string, number[]> = {}
    for (const t of costTxns) {
      const key = `${t['Item type']}::${t['Property address']}`
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(Math.abs(Number(t['Item amount inc VAT'] || 0)))
    }
    const anomalies: any[] = []
    for (const t of costTxns) {
      const key = `${t['Item type']}::${t['Property address']}`
      const vals = buckets[key] || []
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const sd = stddev(vals)
      const amount = Math.abs(Number(t['Item amount inc VAT'] || 0))
      if (sd > 0 && amount > mean + 2 * sd) {
        anomalies.push({ ...t, amount, mean, sd, zScore: ((amount - mean) / sd).toFixed(1) })
      }
    }
    anomalies.sort((a, b) => Number(b.zScore) - Number(a.zScore))

    // Supplier league table from starling_transactions
    const supplierTotals: Record<string, number> = {}
    for (const s of starlingTxns) {
      if (Number(s.amount_gbp) < 0 && s.counter_party) {
        supplierTotals[s.counter_party] = (supplierTotals[s.counter_party] || 0) + Math.abs(Number(s.amount_gbp))
      }
    }
    const supplierTable = Object.entries(supplierTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // Savings: properties > 1.5× portfolio median per category
    const savings: { property: string; category: string; amount: number; median: number; ratio: number }[] = []
    for (const p of properties) {
      for (const cat of categories) {
        const val = propCatTotals[p.property_id]?.[cat] || 0
        const med = catMedians[cat] || 0
        if (med > 0 && val > med * 1.5) {
          savings.push({
            property: p.address?.split(',')[0] || p.property_id,
            category: cat,
            amount: val,
            median: med,
            ratio: val / med,
          })
        }
      }
    }
    savings.sort((a, b) => b.ratio - a.ratio)

    return {
      benchmarkGrid: { propCatTotals, catMedians },
      categories,
      anomalies: anomalies.slice(0, 15),
      supplierTable,
      savings: savings.slice(0, 10),
    }
  }, [transactions, starlingTxns, properties])

  if (loading) return (
    <div style={{ padding: 48, color: TEXT3, fontSize: 13, fontFamily: FONT }}>Loading cost data…</div>
  )

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Benchmark table */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 32 }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Property × Category Benchmark
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: categories.length * 100 + 200 }}>
            <thead>
              <tr>
                <th align="left" style={{
                  position: 'sticky', left: 0, top: 0, background: SURFACE2, zIndex: 3,
                  padding: '9px 14px', fontWeight: 600, fontSize: 10, color: TEXT3,
                  textTransform: 'uppercase', letterSpacing: '1.2px', borderBottom: `1px solid ${BORDER2}`,
                  minWidth: 180,
                }}>
                  Property
                </th>
                {categories.map(cat => (
                  <th key={cat} align="right" style={{
                    position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
                    padding: '9px 10px', fontWeight: 600, fontSize: 10, color: TEXT3,
                    textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${BORDER2}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p, idx) => (
                <tr key={p.property_id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                  <td style={{
                    position: 'sticky', left: 0, background: idx % 2 === 0 ? SURFACE : SURFACE2,
                    padding: '7px 14px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`,
                    whiteSpace: 'nowrap', zIndex: 1,
                  }}>
                    {p.address?.split(',')[0]}
                  </td>
                  {categories.map(cat => {
                    const val = benchmarkGrid.propCatTotals[p.property_id]?.[cat] || 0
                    const med = benchmarkGrid.catMedians[cat] || 0
                    let cellBg = 'transparent'
                    let cellColor = TEXT3
                    if (val > 0 && med > 0) {
                      const ratio = val / med
                      if (ratio <= 0.8) { cellBg = 'rgba(34,197,94,0.1)'; cellColor = GREEN }
                      else if (ratio <= 1.2) { cellBg = 'transparent'; cellColor = TEXT }
                      else if (ratio <= 1.5) { cellBg = 'rgba(245,158,11,0.1)'; cellColor = AMBER }
                      else { cellBg = 'rgba(239,68,68,0.1)'; cellColor = RED }
                    }
                    return (
                      <td key={cat} align="right" style={{
                        padding: '7px 10px', fontSize: 12, fontWeight: val > 0 ? 600 : 400,
                        color: cellColor, background: cellBg, fontVariantNumeric: 'tabular-nums',
                        borderBottom: `1px solid ${BORDER}`,
                      }}>
                        {val > 0 ? `£${fmt(val)}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {/* Median row */}
              <tr style={{ background: SURFACE2 }}>
                <td style={{
                  position: 'sticky', left: 0, background: SURFACE2,
                  padding: '9px 14px', fontSize: 10, color: GOLD, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '1px', borderTop: `1px solid ${BORDER2}`,
                }}>
                  Portfolio Median
                </td>
                {categories.map(cat => (
                  <td key={cat} align="right" style={{
                    padding: '9px 10px', fontSize: 12, fontWeight: 700, color: GOLD,
                    fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}`,
                  }}>
                    {benchmarkGrid.catMedians[cat] > 0 ? `£${fmt(benchmarkGrid.catMedians[cat])}` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies + Supplier + Savings in a row */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Anomaly feed */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 10, color: RED, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Anomalies ({'>'}2σ)
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {anomalies.length === 0 ? (
              <div style={{ padding: '24px 18px', color: TEXT3, fontSize: 12, textAlign: 'center' }}>No anomalies detected.</div>
            ) : anomalies.map((a, i) => (
              <div key={i} style={{ padding: '10px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>{a['Item description'] || a['Item type']}</div>
                  <div style={{ fontSize: 10, color: TEXT3, marginTop: 2 }}>
                    {a['Property address']?.split(',')[0]} · {a['Item type']}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: RED, fontVariantNumeric: 'tabular-nums' }}>
                    £{fmt(a.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: AMBER }}>{a.zScore}σ</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supplier league */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Supplier League Table
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {supplierTable.length === 0 ? (
              <div style={{ padding: '24px 18px', color: TEXT3, fontSize: 12, textAlign: 'center' }}>No supplier data.</div>
            ) : supplierTable.map((s, i) => (
              <div key={i} style={{ padding: '8px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: TEXT3, fontVariantNumeric: 'tabular-nums', width: 18, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: TEXT2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{s.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, fontVariantNumeric: 'tabular-nums' }}>
                  £{fmt(s.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Savings opportunities */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 10, color: GREEN, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Savings Opportunities
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {savings.length === 0 ? (
              <div style={{ padding: '24px 18px', color: TEXT3, fontSize: 12, textAlign: 'center' }}>No savings flagged.</div>
            ) : savings.map((s, i) => (
              <div key={i} style={{ padding: '10px 18px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>{s.property}</div>
                    <div style={{ fontSize: 10, color: TEXT3, marginTop: 2 }}>{s.category}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: RED, fontVariantNumeric: 'tabular-nums' }}>
                      £{fmt(s.amount)}
                    </div>
                    <div style={{ fontSize: 10, color: AMBER }}>{s.ratio.toFixed(1)}× median</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
