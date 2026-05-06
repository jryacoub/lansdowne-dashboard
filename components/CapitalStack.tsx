'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const BG = '#070c14'
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
const TEXT3 = '#7d889d'
const FONT = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 })

export default function CapitalStack() {
  const [properties, setProperties] = useState<any[]>([])
  const [valuations, setValuations] = useState<any[]>([])
  const [capitalTxns, setCapitalTxns] = useState<any[]>([])
  const [selectedPropId, setSelectedPropId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: props }, { data: vals }, { data: capTxns }] = await Promise.all([
        supabase.from('properties_master').select('*').order('property_id'),
        supabase.from('valuations').select('*').order('date', { ascending: true }),
        supabase.from('capital_transactions').select('*').order('date', { ascending: true }),
      ])
      if (props) {
        setProperties(props)
        if (props.length > 0) setSelectedPropId(props[0].property_id)
      }
      if (vals) setValuations(vals)
      if (capTxns) setCapitalTxns(capTxns)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: 48, color: TEXT3, fontSize: 13, fontFamily: FONT }}>Loading capital data…</div>
  )

  // Portfolio-level KPIs
  let totalDeployed = 0, totalEquityReleased = 0, totalNetCash = 0, totalMortgage = 0, totalMV = 0
  for (const p of properties) {
    const cash = (p.cash_deposit_phase1 || 0) + (p.stamp_duty || 0) + (p.solicitor_fees || 0) +
      (p.agent_fee || 0) + (p.renovation_cost || 0) + (p.renovation_mgmt_fee || 0)
    totalDeployed += cash
    totalEquityReleased += p.equity_release || 0
    totalNetCash += cash - (p.equity_release || 0)
    const mort = (p.revaluation_estimate || 0) * (1 - (p.deposit_pct_phase2 || 0))
    totalMortgage += mort
    totalMV += p.market_value_est || 0
  }
  const portfolioLTV = totalMV > 0 ? (totalMortgage / totalMV) * 100 : 0

  const selectedProp = properties.find(p => p.property_id === selectedPropId)

  // Capital waterfall for selected property
  const waterfallItems = selectedProp ? [
    { label: 'Cash Deposit', value: selectedProp.cash_deposit_phase1 || 0, color: GOLD },
    { label: 'Stamp Duty', value: selectedProp.stamp_duty || 0, color: RED },
    { label: 'Solicitor Fees', value: selectedProp.solicitor_fees || 0, color: AMBER },
    { label: 'Agent Fee', value: selectedProp.agent_fee || 0, color: TEXT2 },
    { label: 'Renovation', value: selectedProp.renovation_cost || 0, color: '#4a9eff' },
    { label: 'Reno Mgmt Fee', value: selectedProp.renovation_mgmt_fee || 0, color: '#a78bfa' },
  ] : []

  const waterfallTotal = waterfallItems.reduce((s, i) => s + i.value, 0)

  // Valuations chart for selected property
  // valuations table has property_id = NULL on all rows, so match on address too
  const selectedAddrKey = selectedProp ? (selectedProp.address || '').split(',')[0].trim().toLowerCase() : ''
  const propValuations = valuations.filter(v =>
    v.property_id === selectedPropId ||
    (selectedAddrKey && (v.address || '').toLowerCase().includes(selectedAddrKey))
  )
  const lineData = {
    labels: propValuations.map(v => v.date),
    datasets: [{
      label: 'Valuation (£)',
      data: propValuations.map(v => Number(v.value || v.valuation || v.amount || 0)),
      borderColor: GOLD,
      backgroundColor: 'rgba(201,168,66,0.15)',
      pointBackgroundColor: GOLD,
      pointRadius: 6,
      pointHoverRadius: 8,
      tension: 0,
      fill: true,
    }],
  }

  // Capital transactions for selected property
  const propCapTxns = capitalTxns.filter(t => t.property_id === selectedPropId)

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Portfolio KPI cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Total Deployed', value: `£${fmt(totalDeployed)}`, color: GOLD },
          { label: 'Equity Released', value: `£${fmt(totalEquityReleased)}`, color: GREEN },
          { label: 'Net Cash In', value: `£${fmt(totalNetCash)}`, color: AMBER },
          { label: 'Portfolio LTV', value: `${portfolioLTV.toFixed(1)}%`, color: portfolioLTV <= 75 ? GREEN : portfolioLTV <= 85 ? AMBER : RED },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 4, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12, fontWeight: 600 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Property selector */}
      <div style={{ marginBottom: 24 }}>
        <select
          value={selectedPropId}
          onChange={e => setSelectedPropId(e.target.value)}
          style={{
            background: SURFACE2, color: TEXT, border: `1px solid ${BORDER2}`,
            borderRadius: 3, padding: '8px 32px 8px 14px', fontSize: 12,
            fontFamily: FONT, cursor: 'pointer', minWidth: 300, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a5570'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', outline: 'none',
          }}
        >
          {properties.map(p => (
            <option key={p.property_id} value={p.property_id}>{p.address}, {p.city}</option>
          ))}
        </select>
      </div>

      {/* Waterfall + Valuations side by side */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {/* Capital waterfall */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '20px 24px' }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 20 }}>
            Capital Deployment Waterfall
          </div>
          {waterfallItems.map((item, i) => {
            const pct = waterfallTotal > 0 ? (item.value / waterfallTotal) * 100 : 0
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: TEXT2 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: TEXT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    £{fmt(item.value)}
                  </span>
                </div>
                <div style={{ height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER2}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: TEXT3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Total</span>
            <span style={{ fontSize: 14, color: GOLD, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>£{fmt(waterfallTotal)}</span>
          </div>
          {selectedProp && (selectedProp.equity_release || 0) > 0 && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: GREEN }}>Equity Released</span>
              <span style={{ fontSize: 14, color: GREEN, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                -£{fmt(selectedProp.equity_release)}
              </span>
            </div>
          )}
        </div>

        {/* Valuations chart */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '20px 24px' }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 12 }}>
            Valuation Milestones
          </div>
          {propValuations.length > 0 ? (
            <>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 12, lineHeight: 1.5 }}>
                {propValuations.length} valuation point{propValuations.length === 1 ? '' : 's'} on file.
                {propValuations.length < 5 && ' Limited history — add interim refi estimates to build a real curve.'}
              </div>
              <div style={{ height: 180 }}>
                <Line
                  data={lineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { ticks: { color: TEXT3, font: { size: 10 } }, grid: { color: BORDER } },
                      y: {
                        ticks: {
                          color: TEXT3,
                          font: { size: 10 },
                          callback: (v: string | number) => `£${Number(v).toLocaleString()}`,
                        },
                        grid: { color: BORDER },
                      },
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: SURFACE, titleColor: TEXT2, bodyColor: TEXT, borderColor: BORDER2, borderWidth: 1 },
                    },
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: TEXT3, fontSize: 12 }}>
              No <code>valuations</code> rows on file — chart synthesised from purchase price + current MV only. Add real revaluation events to populate.
            </div>
          )}
        </div>
      </div>

      {/* Capital transactions table */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}`, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Capital Transactions
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: TEXT3 }}>{propCapTxns.length} records</div>
        </div>
        {propCapTxns.length > 0 ? (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Description', 'Amount'].map((h, i) => (
                    <th key={h} align={i === 3 ? 'right' : 'left'} style={{
                      position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
                      padding: '9px 10px', fontWeight: 600, fontSize: 10, color: TEXT3,
                      textTransform: 'uppercase', letterSpacing: '1.2px', borderBottom: `1px solid ${BORDER2}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propCapTxns.map((txn, idx) => (
                  <tr key={txn.transaction_id || idx} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT3, borderBottom: `1px solid ${BORDER}` }}>{txn.date || '—'}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, textTransform: 'capitalize' }}>{txn.type}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>{txn.description || '—'}</td>
                    <td align="right" style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: GOLD, borderBottom: `1px solid ${BORDER}`, fontVariantNumeric: 'tabular-nums' }}>
                      £{fmt(Math.abs(Number(txn.amount)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px 0', textAlign: 'center', color: TEXT3, fontSize: 12 }}>
            No capital transactions recorded for this property.
          </div>
        )}
      </div>
    </div>
  )
}
