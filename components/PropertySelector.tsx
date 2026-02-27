'use client'

import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG       = '#070c14'
const SURFACE  = '#0c1322'
const SURFACE2 = '#111927'
const SURFACE3 = '#162032'
const BORDER   = '#1c2535'
const BORDER2  = '#243045'
const GOLD     = '#c9a842'
const BLUE     = '#4a9eff'
const GREEN    = '#22c55e'
const RED      = '#ef4444'
const AMBER    = '#f59e0b'
const TEXT     = '#dde2ed'
const TEXT2    = '#8e9ab5'
const TEXT3    = '#4a5570'
const FONT     = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

// ─── Target addresses for valuations table ─────────────────────────────────
const TARGET_ADDRESSES = [
  '70 Estcourt Avenue',
  '66 Headingley Mount',
  '38 St Michaels Road',
  '32 Mayville Terrace',
  '25 Christopher Road',
  '8 Talbot Mount',
  '6 Pennington Grove',
  '6 Branksome Terrace',
  '5 Norville Terrace',
]

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Property {
  property_id: string
  address: string
  city: string
  purchase_price: number
  deposit_pct_phase1: number
  cash_deposit_phase1: number
  stamp_duty: number
  solicitor_fees: number
  agent_fee: number
  renovation_cost: number
  renovation_mgmt_fee: number
  mortgage_rate_phase1: number
  revaluation_estimate: number
  market_value_est: number
  market_value_basis: string
  deposit_pct_phase2: number
  equity_release: number
  mortgage_rate_phase2: number
  annual_rent_phase2: number
  bills_phase2: number
  management_phase2: number
  provision_costs_phase2: number
  provision_voids_phase2: number
  beds_phase2: number
  notes_phase2: string | null
  property_link: string | null
}

interface CapitalTransaction {
  transaction_id: string
  property_id: string
  date: string
  type: string
  description: string
  amount: number
}

interface Scenario {
  scenario_id: string
  property_id: string
  scenario_label: string
  revaluation_estimate: number
  deposit_pct_phase2: number
  equity_release: number
  mortgage_rate_phase2: number
  annual_rent_phase2: number
}

interface Valuation {
  id: number
  property_id: string | null
  date: string
  value: number
  source: string
  address: string
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}
function fmtPct(n: number) {
  return n.toFixed(1) + '%'
}
function fmtMonthYear(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ─── Actuals helper: sum capital_transactions by type + description keywords ──
function getCapActual(
  txns: CapitalTransaction[],
  type: string,
  descIncludes?: string[],
  descExcludes?: string[],
): number | null {
  const filtered = txns.filter(t => {
    if (t.type !== type) return false
    const d = (t.description || '').toLowerCase()
    if (descIncludes?.length && !descIncludes.some(k => d.includes(k.toLowerCase()))) return false
    if (descExcludes?.length && descExcludes.some(k => d.includes(k.toLowerCase()))) return false
    return true
  })
  if (!filtered.length) return null
  return Math.abs(filtered.reduce((s, t) => s + (t.amount ?? 0), 0))
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const accent = color || GOLD
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${accent}`,
      borderRadius: 4, padding: '16px 20px', flex: 1, minWidth: 155,
    }}>
      <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 10, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: TEXT3, marginTop: 7, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  )
}

// ─── Basic stat row (no actuals) ──────────────────────────────────────────────
function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: TEXT3, fontSize: 12 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: highlight ? TEXT : TEXT2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Notes key ────────────────────────────────────────────────────────────────
function NotesKey({ notes }: { notes: { index: number; text: string }[] }) {
  if (!notes.length) return null
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
      {notes.map(n => (
        <div key={n.index} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{
            fontSize: 9, color: AMBER, fontWeight: 700, lineHeight: '14px',
            background: 'rgba(245,158,11,0.1)', borderRadius: 2,
            padding: '0 4px', minWidth: 14, textAlign: 'center', flexShrink: 0,
          }}>
            {n.index}
          </span>
          <span style={{ fontSize: 10, color: TEXT3, fontStyle: 'italic', lineHeight: 1.5 }}>{n.text}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Deal Row: budget vs actual from capital_transactions ─────────────────────
//    lowerIsBetter=true  → costs: under budget is ✓ green
//    lowerIsBetter=false → equity release: higher actual is ✓ green
function DealRow({
  label, projected, actual, lowerIsBetter = true, highlight = false, noteIndex,
}: {
  label: string; projected: number; actual: number | null
  lowerIsBetter?: boolean; highlight?: boolean; noteIndex?: number
}) {
  const hasActual = actual !== null
  let indicator = '', indicatorColor = TEXT3, varianceText = ''

  if (hasActual) {
    const variance = actual! - projected
    const variancePct = projected !== 0 ? Math.abs(variance / projected) * 100 : 0
    const isWithin5 = variancePct <= 5
    const isGood = lowerIsBetter ? variance <= 0 : variance >= 0
    if (isWithin5) { indicator = '–'; indicatorColor = AMBER }
    else if (isGood) { indicator = '✓'; indicatorColor = GREEN }
    else { indicator = '⚠'; indicatorColor = RED }
    if (!isWithin5) {
      const absV = Math.abs(variance)
      varianceText = variance > 0 ? `+£${fmt(absV)} over budget` : `-£${fmt(absV)} under budget`
    }
  }

  return (
    <div style={{ padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, fontSize: 12, color: highlight ? TEXT : TEXT3 }}>{label}</span>
        {/* Budget column */}
        <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: TEXT3, minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          £{fmt(projected)}
        </span>
        {/* Actual + indicator column */}
        <div style={{ minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: hasActual ? (highlight ? 700 : 600) : 400, color: hasActual ? TEXT : TEXT3, fontVariantNumeric: 'tabular-nums' }}>
            {hasActual ? `£${fmt(actual!)}` : (!noteIndex ? '—' : '')}
          </span>
          {!hasActual && noteIndex && (
            <span style={{ fontSize: 9, color: AMBER, fontWeight: 700, background: 'rgba(245,158,11,0.1)', borderRadius: 2, padding: '1px 5px' }}>
              {noteIndex}
            </span>
          )}
          {hasActual && indicator && (
            <span style={{ fontSize: 12, fontWeight: 700, color: indicatorColor, lineHeight: 1, minWidth: 14 }}>
              {indicator}
            </span>
          )}
        </div>
      </div>
      {/* Variance sub-line */}
      {varianceText && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: indicatorColor, marginTop: 1, fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>
            {varianceText}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Income Row: projected (annual) vs actual (annualised) from transactions ──
//    isIncome=true  → rent: higher actual is ↑ green
//    isIncome=false → costs: lower actual is ↑ green
function IncomeRow({
  label, projected, actual, isIncome = false, highlight = false, noteIndex,
}: {
  label: string; projected: number; actual: number | null
  isIncome?: boolean; highlight?: boolean; noteIndex?: number
}) {
  const hasActual = actual !== null
  let indicator = '', indicatorColor = TEXT3

  if (hasActual) {
    // For income: positive variance (actual > projected) is good
    // For costs: negative variance (actual < projected) is good
    const rawVariance = actual! - projected
    const variancePct = projected !== 0 ? (rawVariance / Math.abs(projected)) * 100 : 0
    const isWithin5 = Math.abs(variancePct) <= 5
    const isGood = isIncome ? rawVariance >= 0 : rawVariance <= 0
    if (isWithin5) { indicator = '–'; indicatorColor = AMBER }
    else if (isGood) { indicator = '↑'; indicatorColor = GREEN }
    else { indicator = '↓'; indicatorColor = RED }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}`, gap: 4 }}>
      <span style={{ flex: 1, fontSize: 12, color: highlight ? TEXT : TEXT3 }}>{label}</span>
      {/* Projected column */}
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: TEXT3, minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        £{fmt(projected)}
      </span>
      {/* Actual + indicator column */}
      <div style={{ minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <span style={{ fontSize: 12, fontWeight: hasActual ? (highlight ? 700 : 600) : 400, color: hasActual ? TEXT : TEXT3, fontVariantNumeric: 'tabular-nums' }}>
          {hasActual ? `£${fmt(actual!)}` : (!noteIndex ? '—' : '')}
        </span>
        {!hasActual && noteIndex && (
          <span style={{ fontSize: 9, color: AMBER, fontWeight: 700, background: 'rgba(245,158,11,0.1)', borderRadius: 2, padding: '1px 5px' }}>
            {noteIndex}
          </span>
        )}
        {hasActual && (
          <span style={{ fontSize: 14, fontWeight: 700, color: indicatorColor, lineHeight: 1, minWidth: 12 }}>
            {indicator}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Panel column headers ─────────────────────────────────────────────────────
function PanelColHeaders({ col2, col3 }: { col2: string; col3: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 7, marginBottom: 2, borderBottom: `1px solid ${BORDER2}` }}>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600, minWidth: 78, textAlign: 'right' }}>
        {col2}
      </span>
      <span style={{ fontSize: 9, color: GOLD, textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600, minWidth: 110, textAlign: 'right' }}>
        {col3}
      </span>
    </div>
  )
}

// ─── Actuals total bar ────────────────────────────────────────────────────────
function ActualsTotalBar({
  projectedLabel, projected, actual, lowerIsBetter = true, note,
}: {
  projectedLabel: string; projected: number; actual: number | null
  lowerIsBetter?: boolean; note?: string
}) {
  if (actual === null) return null
  const variance = actual - projected
  const variancePct = projected !== 0 ? (variance / Math.abs(projected)) * 100 : 0
  const isGood = lowerIsBetter ? variance <= 0 : variance >= 0
  const isNeutral = Math.abs(variancePct) <= 3
  const color = isNeutral ? AMBER : isGood ? GREEN : RED
  const bgColor = isNeutral ? 'rgba(245,158,11,0.07)' : isGood ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)'
  const badge = `${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}% vs ${lowerIsBetter ? 'budget' : 'business case'}`

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, fontSize: 11, color: TEXT2, fontWeight: 600 }}>{projectedLabel}</span>
        <span style={{ fontSize: 11, color: TEXT3, minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          £{fmt(projected)}
        </span>
        <div style={{ minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontVariantNumeric: 'tabular-nums' }}>
            £{fmt(actual)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        {note && <span style={{ fontSize: 10, color: TEXT3, fontStyle: 'italic' }}>{note}</span>}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color, background: bgColor,
            borderRadius: 3, padding: '3px 8px', letterSpacing: '0.3px',
          }}>
            {badge}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 14 }}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PropertySelector({
  selectedId: externalId,
  onSelectId,
}: {
  selectedId?: string
  onSelectId?: (id: string) => void
} = {}) {
  const [properties, setProperties] = useState<Property[]>([])
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [valuations, setValuations] = useState<Valuation[]>([])
  const [opTransactions, setOpTransactions] = useState<any[]>([])   // operational P&L ledger
  const [internalId, setInternalId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Hide internal picker whenever a parent is managing selection (onSelectId provided)
  const hasParent = onSelectId !== undefined
  // Use the external id when non-empty; fall back to internal (first property on load)
  const selectedId = (externalId && externalId !== '') ? externalId : internalId
  const setSelectedId = (id: string) => {
    setInternalId(id)
    onSelectId?.(id)
  }

  useEffect(() => {
    async function fetchAll() {
      const [
        { data: props },
        { data: txns },
        { data: scens },
        { data: vals },
        { data: ops },
      ] = await Promise.all([
        supabase.from('properties_master').select('*').order('property_id'),
        supabase.from('capital_transactions').select('*').order('property_id'),
        supabase.from('scenarios').select('*').order('property_id'),
        supabase.from('valuations').select('*').in('address', TARGET_ADDRESSES).order('date'),
        supabase.from('transactions').select('*'),
      ])
      if (props && props.length > 0) {
        setProperties(props)
        setInternalId(props[0].property_id)
      }
      if (txns) setCapitalTransactions(txns)
      if (scens) setScenarios(scens)
      if (vals) setValuations(vals)
      if (ops) setOpTransactions(ops)
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div style={{ marginTop: 32, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
        <span style={{ color: TEXT3, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Loading property data
        </span>
      </div>
    )
  }

  // ─── Portfolio aggregate view (when "All Properties" selected) ───────────────
  const showAll = hasParent && (!externalId || externalId === '')

  if (showAll && properties.length > 0) {
    const rows = properties.map(p => {
      const netCash = p.cash_deposit_phase1 + p.stamp_duty + p.solicitor_fees +
        p.agent_fee + p.renovation_cost + p.renovation_mgmt_fee - p.equity_release
      const mortgage = p.revaluation_estimate * (1 - p.deposit_pct_phase2)
      const opCosts = p.management_phase2 + p.provision_costs_phase2 +
        p.provision_voids_phase2 + (p.bills_phase2 || 0)
      const cashflow = p.annual_rent_phase2 - opCosts - (mortgage * p.mortgage_rate_phase2)
      const eq = p.market_value_est - mortgage
      const roi = netCash > 0 ? (cashflow / netCash) * 100 : 0
      const grossYield = (p.annual_rent_phase2 / p.market_value_est) * 100
      return { p, netCash, cashflow, eq, roi, grossYield }
    })

    const totEquity    = rows.reduce((s, r) => s + r.eq, 0)
    const totCashflow  = rows.reduce((s, r) => s + r.cashflow, 0)
    const totNetCash   = rows.reduce((s, r) => s + r.netCash, 0)
    const totMV        = properties.reduce((s, p) => s + p.market_value_est, 0)
    const totRent      = properties.reduce((s, p) => s + p.annual_rent_phase2, 0)
    const portROI      = totNetCash > 0 ? (totCashflow / totNetCash) * 100 : 0
    const portYield    = (totRent / totMV) * 100
    const cfColor      = totCashflow >= 0 ? GREEN : RED
    const roiColor     = portROI >= 10 ? GREEN : portROI >= 0 ? AMBER : RED

    return (
      <div style={{ fontFamily: FONT, color: TEXT }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 3, height: 16, background: GOLD, borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>
            Property Analysis
          </span>
          <span style={{ fontSize: 11, color: TEXT3, marginLeft: 8 }}>Portfolio · {properties.length} properties</span>
        </div>

        {/* Aggregate KPI cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <KpiCard label="Total Equity" value={`£${fmt(totEquity)}`} sub={`${((totEquity / totMV) * 100).toFixed(0)}% of £${fmt(totMV)} portfolio value`} color={BLUE} />
          <KpiCard label="Portfolio ROI" value={fmtPct(portROI)} sub={`£${fmt(totNetCash)} net deployed`} color={roiColor} />
          <KpiCard label="Gross Yield" value={fmtPct(portYield)} sub={`£${fmt(totRent)} annual rent`} color="#a78bfa" />
          <KpiCard label="Annual Cashflow" value={`£${fmt(totCashflow)}`} sub={`£${fmt(Math.round(totCashflow / 12))} / month`} color={cfColor} />
        </div>

        {/* Per-property table */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER2}` }}>
            <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Portfolio Breakdown
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                {['Property', 'Market Value', 'Equity', 'Net Cash In', 'Ann. Cashflow', 'ROI', 'Gross Yield'].map(h => (
                  <th key={h} align={h === 'Property' ? 'left' : 'right'} style={{
                    padding: '8px 14px', fontSize: 10, color: TEXT3, textTransform: 'uppercase',
                    letterSpacing: '1px', fontWeight: 600, borderBottom: `1px solid ${BORDER2}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, netCash, cashflow, eq, roi, grossYield }, i) => {
                const rowCfColor = cashflow >= 0 ? GREEN : RED
                const rowRoiColor = roi >= 10 ? GREEN : roi >= 0 ? AMBER : RED
                return (
                  <tr key={p.property_id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', cursor: 'pointer' }}
                    onClick={() => onSelectId?.(p.property_id)}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>
                      {p.address.split(',')[0]}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: TEXT, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      £{fmt(p.market_value_est)}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: BLUE, fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      £{fmt(eq)}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: TEXT2, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      £{fmt(netCash)}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: rowCfColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      £{fmt(cashflow)}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: rowRoiColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      {fmtPct(roi)}
                    </td>
                    <td align="right" style={{ padding: '8px 14px', fontSize: 12, color: '#a78bfa', fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      {fmtPct(grossYield)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: SURFACE2 }}>
                <td style={{ padding: '10px 14px', fontSize: 11, color: TEXT3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', borderTop: `1px solid ${BORDER2}` }}>
                  Portfolio Total
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: TEXT, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  £{fmt(totMV)}
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: BLUE, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  £{fmt(totEquity)}
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: TEXT, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  £{fmt(totNetCash)}
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: cfColor, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  £{fmt(totCashflow)}
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: roiColor, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  {fmtPct(portROI)}
                </td>
                <td align="right" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${BORDER2}` }}>
                  {fmtPct(portYield)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  const property = properties.find(p => p.property_id === selectedId)
  if (!property) return null

  // ─── Core calculations ─────────────────────────────────────────────────────
  const totalCashInvested =
    property.cash_deposit_phase1 + property.stamp_duty + property.solicitor_fees +
    property.agent_fee + property.renovation_cost + property.renovation_mgmt_fee

  const netCashInvested = totalCashInvested - property.equity_release
  const outstandingMortgage = property.revaluation_estimate * (1 - property.deposit_pct_phase2)
  const annualMortgageInterest = outstandingMortgage * property.mortgage_rate_phase2
  const annualOperatingCosts =
    property.management_phase2 + property.provision_costs_phase2 +
    property.provision_voids_phase2 + (property.bills_phase2 || 0)

  const annualCashflow = property.annual_rent_phase2 - annualOperatingCosts - annualMortgageInterest
  const monthlyCashflow = annualCashflow / 12
  const roi = netCashInvested > 0 ? (annualCashflow / netCashInvested) * 100 : 0
  const equity = property.market_value_est - outstandingMortgage
  const grossYield = (property.annual_rent_phase2 / property.market_value_est) * 100
  const netYield = ((property.annual_rent_phase2 - annualOperatingCosts) / property.market_value_est) * 100

  const propTxns = capitalTransactions.filter(t => t.property_id === selectedId)
  const propScenarios = scenarios.filter(s => s.property_id === selectedId)
  const cashflowColor = monthlyCashflow >= 0 ? GREEN : RED
  const roiColor = roi >= 10 ? GREEN : roi >= 0 ? AMBER : RED

  // ─── Capital transaction actuals (Investment Summary panel) ────────────────
  const actualPurchasePrice   = getCapActual(propTxns, 'purchase')
  const actualStampDuty       = getCapActual(propTxns, 'acquisition_cost', ['stamp', 'sdlt', 'duty'])
  const actualSolicitorFees   = getCapActual(propTxns, 'acquisition_cost', ['solicitor', 'legal', 'convey', 'mortgage fee', 'legal fee'])
  const actualAgentFee        = getCapActual(propTxns, 'acquisition_cost', ['agent', 'sourc', 'finder', 'introduc'])
  const actualRenovCost       = getCapActual(propTxns, 'renovation', undefined, ['manag', 'mgmt', 'project manage'])
  const actualRenovMgmt       = getCapActual(propTxns, 'renovation', ['manag', 'mgmt', 'project manage'])
  const actualEquityReleased  = getCapActual(propTxns, 'refinance')

  // Total deployed actual: sum of all non-refinance capital transactions
  const nonRefinanceTxns = propTxns.filter(t => t.type !== 'refinance')
  const actualTotalDeployed = nonRefinanceTxns.length > 0
    ? Math.abs(nonRefinanceTxns.reduce((s, t) => s + (t.amount ?? 0), 0))
    : null
  const refinanceTxns = propTxns.filter(t => t.type === 'refinance')
  const actualEquityTotal = refinanceTxns.length > 0
    ? Math.abs(refinanceTxns.reduce((s, t) => s + (t.amount ?? 0), 0))
    : null
  const actualNetCashInDeal = actualTotalDeployed !== null
    ? actualTotalDeployed - (actualEquityTotal ?? 0)
    : null

  // ─── Operational transaction actuals (Income & Running Costs panel) ─────────
  // Match transactions by property address (partial match on street name)
  const addrKey = property.address.split(',')[0].trim().toLowerCase()
  const propOpTxns = opTransactions.filter(t =>
    String(t['Property address'] || '').toLowerCase().includes(addrKey)
  )

  // Date range for annualisation
  const opDates = propOpTxns
    .filter(t => t['Item date'])
    .map(t => new Date(t['Item date'] + 'T00:00:00').getTime())
  const opFirstMs = opDates.length > 0 ? Math.min(...opDates) : null
  const opLastMs  = opDates.length > 0 ? Math.max(...opDates) : null
  // Months of data (minimum 1 to avoid divide-by-zero)
  const opMonths = opFirstMs && opLastMs
    ? Math.max(1, (opLastMs - opFirstMs) / (30.44 * 24 * 60 * 60 * 1000) + 1)
    : 0

  // Raw period totals
  const rawRent  = propOpTxns.filter(t => t['Item type'] === 'Rent Paid').reduce((s, t) => s + Number(t['Item amount inc VAT'] ?? 0), 0)
  const rawFees  = propOpTxns.filter(t => t['Item type'] === 'Fee').reduce((s, t) => s + Number(t['Item amount inc VAT'] ?? 0), 0)
  const rawUtils = propOpTxns.filter(t => t['Item type'] === 'Utilities').reduce((s, t) => s + Number(t['Item amount inc VAT'] ?? 0), 0)

  // Annualised actuals (null if no data exists for this property/type)
  const actualRentAnn  = opMonths > 0 && rawRent  !== 0 ? (rawRent  / opMonths) * 12        : null
  const actualMgmtAnn  = opMonths > 0 && rawFees  !== 0 ? (Math.abs(rawFees)  / opMonths) * 12 : null
  const actualBillsAnn = opMonths > 0 && rawUtils !== 0 ? (Math.abs(rawUtils) / opMonths) * 12 : null

  // Partial actuals total for the income panel summary row
  // Only include categories where we have actuals; use matching projected figures for comparison
  const incomeActualItems: { a: number; p: number }[] = []
  if (actualRentAnn  !== null) incomeActualItems.push({ a:  actualRentAnn,  p:  property.annual_rent_phase2 })
  if (actualMgmtAnn  !== null) incomeActualItems.push({ a: -actualMgmtAnn,  p: -property.management_phase2 })
  if (actualBillsAnn !== null) incomeActualItems.push({ a: -actualBillsAnn, p: -(property.bills_phase2 || 0) })
  const incomeActualPartial    = incomeActualItems.length > 0 ? incomeActualItems.reduce((s, i) => s + i.a, 0) : null
  const incomeProjectedPartial = incomeActualItems.length > 0 ? incomeActualItems.reduce((s, i) => s + i.p, 0) : null
  const incomePartialNote = opMonths > 1
    ? `Annualised · ${Math.round(opMonths)} months of data`
    : opMonths > 0 ? 'Annualised · <1 month of data' : undefined

  // ─── Appreciation chart data ───────────────────────────────────────────────
  const propValuations = valuations
    .filter(v => v.address === property.address)
    .sort((a, b) => a.date.localeCompare(b.date))

  type ChartPoint = { date: string; value: number; label: string }
  let chartPoints: ChartPoint[] = []

  if (propValuations.length > 0) {
    chartPoints = propValuations.map(v => ({ date: v.date, value: v.value, label: v.source }))
    const lastValDate = propValuations[propValuations.length - 1].date
    if ('2026-02-26' > lastValDate)
      chartPoints.push({ date: '2026-02-26', value: property.market_value_est, label: 'Market Value Estimate' })
  } else {
    const purchaseTxn  = propTxns.find(t => t.type === 'purchase')
    const refinanceTxn = propTxns.find(t => t.type === 'refinance')
    if (purchaseTxn)  chartPoints.push({ date: purchaseTxn.date,  value: property.purchase_price,       label: 'Purchase Price' })
    if (refinanceTxn) chartPoints.push({ date: refinanceTxn.date, value: property.revaluation_estimate, label: 'Base Case Revaluation' })
    chartPoints.push({ date: '2026-02-26', value: property.market_value_est, label: 'Market Value Estimate' })
  }

  // ─── Payback / Capital-Recovered calculation ───────────────────────────────
  const purchaseChartValue = chartPoints.length > 0 ? chartPoints[0].value : property.purchase_price
  const breakevenTarget = purchaseChartValue + netCashInvested

  let breakevenXIndex: number | null = null
  let breakevenDate: string | null = null
  let projectedPoints: ChartPoint[] = []

  if (chartPoints.length >= 2 && netCashInvested > 0) {
    if (chartPoints[0].value >= breakevenTarget) {
      breakevenXIndex = 0; breakevenDate = chartPoints[0].date
    } else {
      for (let i = 0; i < chartPoints.length - 1; i++) {
        const v0 = chartPoints[i].value, v1 = chartPoints[i + 1].value
        if (v0 < breakevenTarget && v1 >= breakevenTarget) {
          const t = (breakevenTarget - v0) / (v1 - v0)
          breakevenXIndex = i + t
          const d0 = new Date(chartPoints[i].date).getTime()
          const d1 = new Date(chartPoints[i + 1].date).getTime()
          breakevenDate = new Date(d0 + t * (d1 - d0)).toISOString().split('T')[0]
          break
        }
      }
    }
    if (breakevenXIndex === null) {
      const firstMs = new Date(chartPoints[0].date).getTime()
      const lastMs  = new Date(chartPoints[chartPoints.length - 1].date).getTime()
      const firstVal = chartPoints[0].value, lastVal = chartPoints[chartPoints.length - 1].value
      const totalMs = lastMs - firstMs
      if (totalMs > 0 && lastVal > firstVal) {
        const valuePerMs = (lastVal - firstVal) / totalMs
        const msToBreakeven = (breakevenTarget - lastVal) / valuePerMs
        if (msToBreakeven > 0 && msToBreakeven < 25 * 365.25 * 24 * 60 * 60 * 1000) {
          const breakevenMs = lastMs + msToBreakeven
          breakevenDate = new Date(breakevenMs).toISOString().split('T')[0]
          const beyondMs  = breakevenMs + 2 * 365.25 * 24 * 60 * 60 * 1000
          const beyondVal = Math.round(breakevenTarget + valuePerMs * 2 * 365.25 * 24 * 60 * 60 * 1000)
          projectedPoints = [
            { date: breakevenDate, value: breakevenTarget, label: 'Capital Recovered (Projected)' },
            { date: new Date(beyondMs).toISOString().split('T')[0], value: beyondVal, label: 'Projected' },
          ]
          breakevenXIndex = chartPoints.length
        }
      }
    }
  }

  const allChartPoints = [...chartPoints, ...projectedPoints]
  const hasProjected = projectedPoints.length > 0

  // ─── Chart datasets ────────────────────────────────────────────────────────
  const mainDataset: any = {
    label: 'Property Value',
    data: allChartPoints.map((_, i) => (i < chartPoints.length ? chartPoints[i].value : null)),
    borderColor: GOLD, backgroundColor: 'rgba(201,168,66,0.06)', fill: true, tension: 0.35,
    pointRadius: allChartPoints.map((_, i) => (i < chartPoints.length ? 5 : 0)),
    pointHoverRadius: 7,
    pointBackgroundColor: allChartPoints.map((_, i) => {
      if (i >= chartPoints.length) return GOLD
      if (i === 0) return BLUE
      if (i === chartPoints.length - 1) return GREEN
      return GOLD
    }),
    pointBorderColor: SURFACE, pointBorderWidth: 2, borderWidth: 2, spanGaps: false,
  }

  const projectedDataset: any = hasProjected ? {
    label: 'Projected',
    data: allChartPoints.map((p, i) => (i < chartPoints.length - 1 ? null : p.value)),
    borderColor: 'rgba(201,168,66,0.35)', backgroundColor: 'transparent',
    borderDash: [6, 4], fill: false, tension: 0.35,
    pointRadius: allChartPoints.map((_, i) => {
      if (i < chartPoints.length) return 0
      if (i === chartPoints.length) return 8
      return 4
    }),
    pointHoverRadius: 9,
    pointBackgroundColor: allChartPoints.map((_, i) => {
      if (i < chartPoints.length) return 'transparent'
      if (i === chartPoints.length) return GOLD
      return 'rgba(201,168,66,0.3)'
    }),
    pointBorderColor: allChartPoints.map((_, i) => (i === chartPoints.length ? GOLD : SURFACE)),
    pointBorderWidth: allChartPoints.map((_, i) => (i === chartPoints.length ? 0 : 1)),
    spanGaps: false,
  } : null

  const chartData = {
    labels: allChartPoints.map(p => fmtMonthYear(p.date)),
    datasets: projectedDataset ? [mainDataset, projectedDataset] : [mainDataset],
  }

  // ─── Breakeven plugin ──────────────────────────────────────────────────────
  const breakevenPlugin: any = breakevenXIndex !== null ? {
    id: 'breakevenMarker',
    beforeDatasetsDraw(chart: any) {
      if (breakevenXIndex === null) return
      const { ctx, chartArea, scales } = chart
      const xScale = scales.x
      const n = allChartPoints.length
      const i0 = Math.floor(breakevenXIndex), i1 = Math.min(i0 + 1, n - 1)
      const frac = breakevenXIndex - i0
      const px0 = xScale.getPixelForValue(fmtMonthYear(allChartPoints[i0].date))
      const px1 = xScale.getPixelForValue(fmtMonthYear(allChartPoints[i1].date))
      const xPx = frac === 0 ? px0 : px0 + frac * (px1 - px0)
      ctx.save()
      ctx.fillStyle = 'rgba(239,68,68,0.07)'
      ctx.fillRect(chartArea.left, chartArea.top, xPx - chartArea.left, chartArea.bottom - chartArea.top)
      ctx.fillStyle = 'rgba(34,197,94,0.06)'
      ctx.fillRect(xPx, chartArea.top, chartArea.right - xPx, chartArea.bottom - chartArea.top)
      ctx.restore()
    },
    afterDraw(chart: any) {
      if (breakevenXIndex === null) return
      const { ctx, chartArea, scales } = chart
      const xScale = scales.x
      const n = allChartPoints.length
      const i0 = Math.floor(breakevenXIndex), i1 = Math.min(i0 + 1, n - 1)
      const frac = breakevenXIndex - i0
      const px0 = xScale.getPixelForValue(fmtMonthYear(allChartPoints[i0].date))
      const px1 = xScale.getPixelForValue(fmtMonthYear(allChartPoints[i1].date))
      const xPx = frac === 0 ? px0 : px0 + frac * (px1 - px0)
      ctx.save()
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.7
      ctx.beginPath(); ctx.moveTo(xPx, chartArea.top); ctx.lineTo(xPx, chartArea.bottom); ctx.stroke()
      ctx.setLineDash([]); ctx.globalAlpha = 1
      const label = 'Capital Recovered'
      ctx.font = `600 10px ${FONT}`
      const textW = ctx.measureText(label).width
      const hPad = 8, boxW = textW + hPad * 2, boxH = 20
      const flagY = chartArea.top + 8, midY = flagY + boxH / 2, gap = 5
      const onRight = (chartArea.right - xPx) >= boxW + gap + 8
      const boxX = onRight ? xPx + gap : xPx - gap - boxW
      ctx.fillStyle = GOLD
      const r = 3
      ctx.beginPath()
      ctx.moveTo(boxX + r, flagY); ctx.lineTo(boxX + boxW - r, flagY)
      ctx.quadraticCurveTo(boxX + boxW, flagY, boxX + boxW, flagY + r)
      ctx.lineTo(boxX + boxW, flagY + boxH - r)
      ctx.quadraticCurveTo(boxX + boxW, flagY + boxH, boxX + boxW - r, flagY + boxH)
      ctx.lineTo(boxX + r, flagY + boxH)
      ctx.quadraticCurveTo(boxX, flagY + boxH, boxX, flagY + boxH - r)
      ctx.lineTo(boxX, flagY + r); ctx.quadraticCurveTo(boxX, flagY, boxX + r, flagY)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = GOLD; ctx.beginPath()
      if (onRight) { ctx.moveTo(xPx + gap, midY - 4); ctx.lineTo(xPx, midY); ctx.lineTo(xPx + gap, midY + 4) }
      else { ctx.moveTo(xPx - gap, midY - 4); ctx.lineTo(xPx, midY); ctx.lineTo(xPx - gap, midY + 4) }
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#070c14'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      ctx.fillText(label, boxX + hPad, midY)
      ctx.restore()
    },
  } : null

  // ─── Chart options ─────────────────────────────────────────────────────────
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => allChartPoints[items[0].dataIndex]?.label || '',
          label: (item: any) => (item.raw !== null ? `£${fmt(item.raw)}` : null),
        },
        backgroundColor: SURFACE, titleColor: TEXT2, bodyColor: TEXT,
        borderColor: BORDER2, borderWidth: 1, padding: 12,
        titleFont: { size: 11, weight: '600' as const },
        bodyFont: { size: 13, weight: '700' as const },
      },
    },
    scales: {
      x: { grid: { color: BORDER, drawBorder: false }, ticks: { color: TEXT3, font: { size: 10 }, maxRotation: 0 }, border: { color: BORDER } },
      y: { grid: { color: BORDER, drawBorder: false }, ticks: { color: TEXT3, font: { size: 10 }, callback: (v: any) => `£${(v / 1000).toFixed(0)}k` }, border: { color: BORDER } },
    },
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, color: TEXT }}>

      {/* ── PROPERTY ANALYSIS HEADER ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 3, height: 16, background: GOLD, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>
              Property Analysis
            </span>
          </div>
          {/* Internal picker: only shown when no parent is managing selection */}
          {!hasParent && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                background: SURFACE, color: TEXT, border: `1px solid ${BORDER2}`,
                borderRadius: 3, padding: '7px 32px 7px 12px', fontSize: 13,
                fontFamily: FONT, cursor: 'pointer', minWidth: 280, appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a5570'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', outline: 'none', letterSpacing: '0.2px',
              }}
            >
              {properties.map(p => (
                <option key={p.property_id} value={p.property_id}>{p.address}, {p.city}</option>
              ))}
            </select>
          )}
          {property.property_link && (
            <a href={property.property_link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: GOLD, textDecoration: 'none', border: `1px solid rgba(201,168,66,0.3)`, borderRadius: 3, padding: '4px 10px', letterSpacing: '0.5px' }}>
              View listing ↗
            </a>
          )}
        </div>
        <div style={{ fontSize: 11, color: TEXT3 }}>{property.beds_phase2} beds · {property.city}</div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Cash-on-Cash ROI" value={fmtPct(roi)} sub={`£${fmt(netCashInvested)} net deployed`} color={roiColor} />
        <KpiCard label="Equity" value={`£${fmt(equity)}`} sub={`${fmt(property.market_value_est)} MV · ${((equity / property.market_value_est) * 100).toFixed(0)}% ownership`} color={BLUE} />
        <KpiCard label="Gross Yield" value={fmtPct(grossYield)} sub={`Net yield ${fmtPct(netYield)}`} color="#a78bfa" />
        <KpiCard label="Monthly Cashflow" value={`£${fmt(monthlyCashflow)}`} sub={`£${fmt(annualCashflow)} p.a.`} color={cashflowColor} />
      </div>

      {/* ── ASSET APPRECIATION CHART ────────────────────────────────────── */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionHeading>Asset Appreciation</SectionHeading>
          <span style={{ fontSize: 11, color: TEXT3 }}>{property.address}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {chartPoints.map((p, i) => (
            <div key={i} style={{ background: SURFACE2, borderRadius: 3, padding: '8px 14px', borderLeft: `2px solid ${i === 0 ? BLUE : i === chartPoints.length - 1 ? GREEN : GOLD}` }}>
              <div style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, fontVariantNumeric: 'tabular-nums' }}>£{fmt(p.value)}</div>
              <div style={{ fontSize: 10, color: TEXT3, marginTop: 3 }}>{fmtMonthYear(p.date)}</div>
            </div>
          ))}
          {chartPoints.length >= 2 && (
            <div style={{ background: SURFACE2, borderRadius: 3, padding: '8px 14px', borderLeft: `2px solid ${GOLD}` }}>
              <div style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Total Appreciation</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                +£{fmt(chartPoints[chartPoints.length - 1].value - chartPoints[0].value)}
              </div>
              <div style={{ fontSize: 10, color: TEXT3, marginTop: 3 }}>
                +{(((chartPoints[chartPoints.length - 1].value - chartPoints[0].value) / chartPoints[0].value) * 100).toFixed(1)}% from purchase
              </div>
            </div>
          )}
          {breakevenDate !== null && (
            <div style={{ background: SURFACE2, borderRadius: 3, padding: '8px 14px', borderLeft: `2px solid ${GOLD}`, boxShadow: `0 0 16px rgba(201,168,66,0.10)` }}>
              <div style={{ fontSize: 9, color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4, fontWeight: 700 }}>Capital Recovered</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtMonthYear(breakevenDate)}</div>
              <div style={{ fontSize: 10, color: TEXT3, marginTop: 3 }}>
                {new Date(breakevenDate) <= new Date('2026-02-27') ? 'Already achieved' : `Projected · target £${fmt(breakevenTarget)}`}
              </div>
            </div>
          )}
        </div>
        <div style={{ height: 270 }}>
          <Line data={chartData} options={chartOptions as any} plugins={(breakevenPlugin ? [breakevenPlugin] : []) as any} />
        </div>
      </div>

      {/* ── DEAL SHEET PANELS ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>

        {/* ── INVESTMENT SUMMARY ──────────────────────────────────────── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '18px 20px', flex: 1.4, minWidth: 360 }}>
          <SectionHeading>Investment Summary</SectionHeading>
          <PanelColHeaders col2="Budget" col3="Actual" />

          <DealRow label="Purchase price"         projected={property.purchase_price}       actual={actualPurchasePrice}   noteIndex={1} />
          <StatRow label="Deposit (Phase 1)"      value={`£${fmt(property.cash_deposit_phase1)} (${(property.deposit_pct_phase1 * 100).toFixed(0)}%)`} />
          <DealRow label="Stamp duty"             projected={property.stamp_duty}           actual={actualStampDuty}       noteIndex={1} />
          <DealRow label="Solicitor & mtg fees"   projected={property.solicitor_fees}       actual={actualSolicitorFees}   noteIndex={1} />
          <DealRow label="Agent fee"              projected={property.agent_fee}            actual={actualAgentFee}        noteIndex={1} />
          <DealRow label="Renovation cost"        projected={property.renovation_cost}      actual={actualRenovCost}       noteIndex={1} />
          <DealRow label="Renovation mgmt fee"    projected={property.renovation_mgmt_fee}  actual={actualRenovMgmt}       noteIndex={1} />

          <div style={{ height: 1, background: BORDER2, margin: '10px 0 6px' }} />
          <DealRow label="Total cash deployed"    projected={totalCashInvested}             actual={actualTotalDeployed}   noteIndex={1} highlight />
          <DealRow label="Equity released"        projected={property.equity_release}       actual={actualEquityReleased}  noteIndex={1} lowerIsBetter={false} />
          <DealRow label="Net cash in deal"       projected={netCashInvested}               actual={actualNetCashInDeal}   noteIndex={1} highlight />

          <ActualsTotalBar
            projectedLabel="Net cash deployed vs budget"
            projected={netCashInvested}
            actual={actualNetCashInDeal}
            lowerIsBetter
          />
          {[actualPurchasePrice, actualStampDuty, actualSolicitorFees, actualAgentFee, actualRenovCost, actualRenovMgmt, actualEquityReleased, actualTotalDeployed, actualNetCashInDeal].some(a => a === null) && (
            <NotesKey notes={[{ index: 1, text: 'No matching entry found in capital transactions — record not yet added' }]} />
          )}
        </div>

        {/* ── INCOME & RUNNING COSTS ──────────────────────────────────── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '18px 20px', flex: 1.4, minWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionHeading>Income & Running Costs (Phase 2)</SectionHeading>
            {opMonths > 0 && (
              <span style={{ fontSize: 10, color: TEXT3, fontStyle: 'italic', whiteSpace: 'nowrap', marginLeft: 8 }}>
                Actual = ann. · {Math.round(opMonths)}mo data
              </span>
            )}
          </div>
          <PanelColHeaders col2="Projected" col3="Actual (ann.)" />

          <StatRow label="Beds" value={String(property.beds_phase2)} />
          <IncomeRow label="Annual rent"                projected={property.annual_rent_phase2}      actual={actualRentAnn}  isIncome  noteIndex={1} />
          <div style={{ height: 1, background: BORDER2, margin: '8px 0 4px' }} />
          <IncomeRow label="Management"                 projected={property.management_phase2}       actual={actualMgmtAnn}             noteIndex={1} />
          <IncomeRow label="Maintenance provision"      projected={property.provision_costs_phase2}  actual={null}                      noteIndex={2} />
          <IncomeRow label="Void provision"             projected={property.provision_voids_phase2}  actual={null}                      noteIndex={2} />
          {property.bills_phase2 > 0 && (
            <IncomeRow label="Bills"                    projected={property.bills_phase2}            actual={actualBillsAnn}            noteIndex={1} />
          )}
          <IncomeRow label="Mortgage interest (p.a.)"  projected={annualMortgageInterest}           actual={null}                      noteIndex={3} />
          <StatRow   label="Mortgage rate"             value={`${(property.mortgage_rate_phase2 * 100).toFixed(1)}%`} />
          <div style={{ height: 1, background: BORDER2, margin: '8px 0 4px' }} />
          <StatRow label="Annual cashflow"  value={`£${fmt(annualCashflow)}`}   highlight />
          <StatRow label="Monthly cashflow" value={`£${fmt(monthlyCashflow)}`}  highlight />

          {incomeActualPartial !== null && incomeProjectedPartial !== null && (
            <ActualsTotalBar
              projectedLabel="Revenue & direct costs (partial)"
              projected={incomeProjectedPartial}
              actual={incomeActualPartial}
              lowerIsBetter={false}
              note={incomePartialNote}
            />
          )}
          <NotesKey notes={[
            ...((!actualRentAnn || !actualMgmtAnn || !actualBillsAnn) ? [{ index: 1, text: 'No transactions found in the P&L ledger for this property/category' }] : []),
            { index: 2, text: 'Provision estimate only — not tracked as a direct cash cost in the ledger' },
            { index: 3, text: 'Calculated from mortgage rate × outstanding balance; not a direct cash transaction' },
          ]} />
        </div>

        {/* ── VALUATION & EQUITY ─────────────────────────────────────── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '18px 20px', flex: 1, minWidth: 260 }}>
          <SectionHeading>Valuation & Equity</SectionHeading>
          <StatRow label="Base Case Revaluation"    value={`£${fmt(property.revaluation_estimate)}`} />
          <StatRow label="Market Value Estimate"    value={`£${fmt(property.market_value_est)}`} />
          <StatRow label="Basis"                    value={property.market_value_basis} />
          <div style={{ height: 1, background: BORDER2, margin: '10px 0 6px' }} />
          <StatRow label="LTV (Phase 2)"            value={`${((1 - property.deposit_pct_phase2) * 100).toFixed(0)}%`} />
          <StatRow label="Outstanding mortgage"     value={`£${fmt(outstandingMortgage)}`} />
          <StatRow label="Equity (vs market value)" value={`£${fmt(equity)}`} highlight />
          {property.notes_phase2 && (
            <>
              <div style={{ height: 1, background: BORDER2, margin: '10px 0 6px' }} />
              <StatRow label="Notes" value={property.notes_phase2} />
            </>
          )}
          {propTxns.length > 0 && (
            <>
              <div style={{ height: 1, background: BORDER2, margin: '14px 0 10px' }} />
              <SectionHeading>Capital Transactions</SectionHeading>
              {propTxns.map(t => (
                <StatRow
                  key={t.transaction_id}
                  label={`${t.date} · ${t.description}`}
                  value={`${t.amount < 0 ? '-' : '+'}£${fmt(Math.abs(t.amount))}`}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── SCENARIOS TABLE ────────────────────────────────────────────── */}
      {propScenarios.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER2}`, display: 'flex', alignItems: 'center' }}>
            <SectionHeading>Scenario Analysis</SectionHeading>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: SURFACE2 }}>
                  {['Scenario', 'Base Case Revaluation', 'Equity Release', 'Mortgage Rate', 'Annual Rent', 'Cashflow / mo', 'ROI'].map((h, i) => (
                    <th key={h} align={i === 0 ? 'left' : 'right'}
                      style={{ padding: '9px 14px', color: TEXT3, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `1px solid ${BORDER2}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propScenarios.map((s, idx) => {
                  const sMortgage = s.revaluation_estimate * (1 - s.deposit_pct_phase2)
                  const sMortgageInterest = sMortgage * s.mortgage_rate_phase2
                  const sNetCashIn = totalCashInvested - s.equity_release
                  const sCashflow = s.annual_rent_phase2 - annualOperatingCosts - sMortgageInterest
                  const sRoi = sNetCashIn > 0 ? (sCashflow / sNetCashIn) * 100 : 0
                  const cfColor = sCashflow >= 0 ? GREEN : RED
                  const roiC = sRoi >= 10 ? GREEN : sRoi >= 0 ? AMBER : RED
                  return (
                    <tr key={s.scenario_id}
                      style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: TEXT }}>{s.scenario_label}</td>
                      <td align="right" style={{ padding: '9px 14px', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.revaluation_estimate)}</td>
                      <td align="right" style={{ padding: '9px 14px', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.equity_release)}</td>
                      <td align="right" style={{ padding: '9px 14px', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>{(s.mortgage_rate_phase2 * 100).toFixed(1)}%</td>
                      <td align="right" style={{ padding: '9px 14px', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.annual_rent_phase2)}</td>
                      <td align="right" style={{ padding: '9px 14px', fontWeight: 600, color: cfColor, fontVariantNumeric: 'tabular-nums' }}>£{fmt(sCashflow / 12)}</td>
                      <td align="right" style={{ padding: '9px 14px' }}>
                        <span style={{
                          background: sRoi >= 10 ? 'rgba(34,197,94,0.10)' : sRoi >= 0 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)',
                          color: roiC, fontWeight: 700, fontSize: 11, borderRadius: 3, padding: '2px 8px', fontVariantNumeric: 'tabular-nums',
                        }}>
                          {fmtPct(sRoi)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
