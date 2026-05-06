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

export default function RentRoll() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: txns }, { data: props }] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('properties_master').select('*').order('property_id'),
      ])
      if (txns) setTransactions(txns)
      if (props) setProperties(props)
      setLoading(false)
    }
    load()
  }, [])

  // Build property × month grid
  const { months, propGrid, kpis } = useMemo(() => {
    const rentTxns = transactions.filter(t => t['Item type'] === 'Rent Paid')

    // Get all unique months (YYYY-MM)
    const monthSet = new Set<string>()
    for (const t of rentTxns) {
      if (t['Item date']) monthSet.add(t['Item date'].slice(0, 7))
    }
    const months = Array.from(monthSet).sort()

    // Map each property to its rent transactions
    const propGrid: Record<string, Record<string, number>> = {}
    for (const p of properties) {
      propGrid[p.property_id] = {}
      const addrKey = (p.address || '').split(',')[0].trim().toLowerCase()
      for (const t of rentTxns) {
        const tAddr = String(t['Property address'] || '').toLowerCase()
        if (tAddr.includes(addrKey)) {
          const month = t['Item date']?.slice(0, 7)
          if (month) {
            propGrid[p.property_id][month] = (propGrid[p.property_id][month] || 0) + Number(t['Item amount inc VAT'] || 0)
          }
        }
      }
    }

    // KPIs
    const lastMonth = months.length > 0 ? months[months.length - 1] : null
    let collectedLastMonth = 0, expectedLastMonth = 0
    let occupiedCount = 0, atRiskCount = 0, annualTarget = 0
    const last3Months = months.slice(-3)

    for (const p of properties) {
      const monthlyExpected = (p.annual_rent_phase2 || 0) / 12
      annualTarget += p.annual_rent_phase2 || 0

      if (lastMonth && propGrid[p.property_id]?.[lastMonth]) {
        collectedLastMonth += propGrid[p.property_id][lastMonth]
      }
      expectedLastMonth += monthlyExpected

      // Occupancy: has any rent in last 3 months
      const has3mRent = last3Months.some(m => (propGrid[p.property_id]?.[m] || 0) > 0)
      if (has3mRent) occupiedCount++

      // At-risk: 3-month collection < 80% of expected
      if (monthlyExpected > 0) {
        const collected3m = last3Months.reduce((s, m) => s + (propGrid[p.property_id]?.[m] || 0), 0)
        const expected3m = monthlyExpected * last3Months.length
        if (collected3m / expected3m < 0.8) atRiskCount++
      }
    }

    const collectionPct = expectedLastMonth > 0 ? (collectedLastMonth / expectedLastMonth) * 100 : 0
    const occupancyPct = properties.length > 0 ? (occupiedCount / properties.length) * 100 : 0

    return {
      months,
      propGrid,
      kpis: { collectionPct, occupancyPct, atRiskCount, annualTarget },
    }
  }, [transactions, properties])

  if (loading) return (
    <div style={{ padding: 48, color: TEXT3, fontSize: 13, fontFamily: FONT }}>Loading rent roll…</div>
  )

  // Show last 12 months
  const displayMonths = months.slice(-12)

  return (
    <div style={{ fontFamily: FONT }}>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Last Month Collection', value: `${kpis.collectionPct.toFixed(1)}%`, color: kpis.collectionPct >= 95 ? GREEN : kpis.collectionPct >= 80 ? AMBER : RED },
          { label: 'Occupancy', value: `${kpis.occupancyPct.toFixed(0)}%`, color: kpis.occupancyPct >= 90 ? GREEN : kpis.occupancyPct >= 70 ? AMBER : RED },
          { label: 'At-Risk Properties', value: String(kpis.atRiskCount), color: kpis.atRiskCount === 0 ? GREEN : kpis.atRiskCount <= 2 ? AMBER : RED },
          { label: 'Annual Rent Target', value: `£${fmt(kpis.annualTarget)}`, color: GOLD },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 4, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12, fontWeight: 600 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: kpi.color, letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Property × month collection grid */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Monthly Rent Collection
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: displayMonths.length * 80 + 200 }}>
            <thead>
              <tr>
                <th align="left" style={{
                  position: 'sticky', left: 0, top: 0, background: SURFACE2, zIndex: 3,
                  padding: '9px 14px', fontWeight: 600, fontSize: 10, color: TEXT3,
                  textTransform: 'uppercase', letterSpacing: '1.2px', borderBottom: `1px solid ${BORDER2}`,
                  minWidth: 200,
                }}>
                  Property
                </th>
                {displayMonths.map(m => (
                  <th key={m} align="right" style={{
                    position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
                    padding: '9px 10px', fontWeight: 600, fontSize: 10, color: TEXT3,
                    textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${BORDER2}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p, idx) => {
                const expected = (p.annual_rent_phase2 || 0) / 12
                return (
                  <tr key={p.property_id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{
                      position: 'sticky', left: 0, background: idx % 2 === 0 ? SURFACE : SURFACE2,
                      padding: '7px 14px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`,
                      whiteSpace: 'nowrap', zIndex: 1,
                    }}>
                      {p.address?.split(',')[0]}
                    </td>
                    {displayMonths.map(m => {
                      const collected = propGrid[p.property_id]?.[m] || 0
                      const ratio = expected > 0 ? collected / expected : 0
                      let cellBg = 'transparent'
                      let cellColor = TEXT3
                      if (collected > 0) {
                        if (ratio >= 0.95) { cellBg = 'rgba(34,197,94,0.12)'; cellColor = GREEN }
                        else if (ratio >= 0.5) { cellBg = 'rgba(245,158,11,0.12)'; cellColor = AMBER }
                        else { cellBg = 'rgba(239,68,68,0.12)'; cellColor = RED }
                      }
                      return (
                        <td key={m} align="right" style={{
                          padding: '7px 10px', fontSize: 12, fontWeight: collected > 0 ? 600 : 400,
                          color: cellColor, background: cellBg, fontVariantNumeric: 'tabular-nums',
                          borderBottom: `1px solid ${BORDER}`,
                        }}>
                          {collected > 0 ? `£${fmt(collected)}` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
