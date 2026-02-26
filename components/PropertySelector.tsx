'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

function fmt(n: number) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  return n.toFixed(1) + '%'
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: 10,
      padding: '18px 22px',
      flex: 1,
      minWidth: 160,
      borderTop: `3px solid ${color || '#cc6600'}`,
    }}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #222' }}>
      <span style={{ color: '#888', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function PropertySelector() {
  const [properties, setProperties] = useState<Property[]>([])
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [{ data: props }, { data: txns }, { data: scens }] = await Promise.all([
        supabase.from('properties_master').select('*').order('property_id'),
        supabase.from('capital_transactions').select('*').order('property_id'),
        supabase.from('scenarios').select('*').order('property_id'),
      ])
      if (props && props.length > 0) {
        setProperties(props)
        setSelectedId(props[0].property_id)
      }
      if (txns) setCapitalTransactions(txns)
      if (scens) setScenarios(scens)
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div style={{ marginTop: 40, background: '#111', borderRadius: 12, padding: 28 }}>
        <div style={{ color: '#888' }}>Loading property data...</div>
      </div>
    )
  }

  const property = properties.find(p => p.property_id === selectedId)
  if (!property) return null

  // --- Core calculations ---
  const totalCashInvested =
    property.cash_deposit_phase1 +
    property.stamp_duty +
    property.solicitor_fees +
    property.agent_fee +
    property.renovation_cost +
    property.renovation_mgmt_fee

  const netCashInvested = totalCashInvested - property.equity_release

  const outstandingMortgage = property.revaluation_estimate * (1 - property.deposit_pct_phase2)

  const annualMortgageInterest = outstandingMortgage * property.mortgage_rate_phase2

  const annualOperatingCosts =
    property.management_phase2 +
    property.provision_costs_phase2 +
    property.provision_voids_phase2 +
    (property.bills_phase2 || 0)

  const annualCashflow = property.annual_rent_phase2 - annualOperatingCosts - annualMortgageInterest
  const monthlyCashflow = annualCashflow / 12

  const roi = netCashInvested > 0 ? (annualCashflow / netCashInvested) * 100 : 0
  const equity = property.market_value_est - outstandingMortgage
  const grossYield = (property.annual_rent_phase2 / property.market_value_est) * 100
  const netYield = ((property.annual_rent_phase2 - annualOperatingCosts) / property.market_value_est) * 100

  // Capital transactions for this property
  const propTxns = capitalTransactions.filter(t => t.property_id === selectedId)

  // Scenarios for this property
  const propScenarios = scenarios.filter(s => s.property_id === selectedId)

  const cashflowColor = monthlyCashflow >= 0 ? '#4ade80' : '#ef4444'
  const roiColor = roi >= 10 ? '#4ade80' : roi >= 0 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ marginTop: 48, fontFamily: 'system-ui' }}>
      {/* Header + Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 'bold', fontSize: 24, color: '#cc6600', margin: 0 }}>
          Property Analysis
        </h2>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            background: '#1a1a1a',
            color: '#eee',
            border: '1px solid #444',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 15,
            fontFamily: 'system-ui',
            cursor: 'pointer',
            minWidth: 260,
          }}
        >
          {properties.map(p => (
            <option key={p.property_id} value={p.property_id}>
              {p.address}, {p.city}
            </option>
          ))}
        </select>
        {property.property_link && (
          <a
            href={property.property_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#cc6600', textDecoration: 'underline' }}
          >
            View listing ↗
          </a>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard
          label="ROI on Cash"
          value={fmtPct(roi)}
          sub={`£${fmt(netCashInvested)} net invested`}
          color={roiColor}
        />
        <KpiCard
          label="Equity"
          value={`£${fmt(equity)}`}
          sub={`£${fmt(property.market_value_est)} est. value`}
          color="#60a5fa"
        />
        <KpiCard
          label="Gross Yield"
          value={fmtPct(grossYield)}
          sub={`Net yield ${fmtPct(netYield)}`}
          color="#a78bfa"
        />
        <KpiCard
          label="Monthly Cashflow"
          value={`£${fmt(monthlyCashflow)}`}
          sub={`£${fmt(annualCashflow)} / year`}
          color={cashflowColor}
        />
      </div>

      {/* Details grid */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>

        {/* Property & Investment */}
        <div style={{ background: '#111', borderRadius: 12, padding: 20, flex: 1, minWidth: 260 }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 14, color: '#cc6600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Investment Summary
          </h3>
          <StatRow label="Purchase price" value={`£${fmt(property.purchase_price)}`} />
          <StatRow label="Deposit (Phase 1)" value={`£${fmt(property.cash_deposit_phase1)} (${(property.deposit_pct_phase1 * 100).toFixed(0)}%)`} />
          <StatRow label="Stamp duty" value={`£${fmt(property.stamp_duty)}`} />
          <StatRow label="Solicitor & mortgage fees" value={`£${fmt(property.solicitor_fees)}`} />
          <StatRow label="Agent fee" value={`£${fmt(property.agent_fee)}`} />
          <StatRow label="Renovation cost" value={`£${fmt(property.renovation_cost)}`} />
          <StatRow label="Renovation mgmt fee" value={`£${fmt(property.renovation_mgmt_fee)}`} />
          <StatRow label="Total cash deployed" value={`£${fmt(totalCashInvested)}`} />
          <StatRow label="Equity released" value={`£${fmt(property.equity_release)}`} />
          <StatRow label="Net cash in deal" value={`£${fmt(netCashInvested)}`} />
        </div>

        {/* Income & Costs */}
        <div style={{ background: '#111', borderRadius: 12, padding: 20, flex: 1, minWidth: 260 }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 14, color: '#cc6600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Income & Running Costs (Phase 2)
          </h3>
          <StatRow label="Beds" value={String(property.beds_phase2)} />
          <StatRow label="Annual rent" value={`£${fmt(property.annual_rent_phase2)}`} />
          <StatRow label="Management" value={`-£${fmt(property.management_phase2)}`} />
          <StatRow label="Maintenance provision" value={`-£${fmt(property.provision_costs_phase2)}`} />
          <StatRow label="Void provision" value={`-£${fmt(property.provision_voids_phase2)}`} />
          {property.bills_phase2 > 0 && <StatRow label="Bills" value={`-£${fmt(property.bills_phase2)}`} />}
          <StatRow label="Mortgage interest (p.a.)" value={`-£${fmt(annualMortgageInterest)}`} />
          <StatRow label="Mortgage rate" value={`${(property.mortgage_rate_phase2 * 100).toFixed(1)}%`} />
          <StatRow label="Annual cashflow" value={`£${fmt(annualCashflow)}`} />
          <StatRow label="Monthly cashflow" value={`£${fmt(monthlyCashflow)}`} />
        </div>

        {/* Valuation */}
        <div style={{ background: '#111', borderRadius: 12, padding: 20, flex: 1, minWidth: 260 }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 14, color: '#cc6600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Valuation & Equity
          </h3>
          <StatRow label="Revaluation (Phase 2)" value={`£${fmt(property.revaluation_estimate)}`} />
          <StatRow label="Market value est." value={`£${fmt(property.market_value_est)}`} />
          <StatRow label="Basis" value={property.market_value_basis} />
          <StatRow label="LTV (Phase 2)" value={`${((1 - property.deposit_pct_phase2) * 100).toFixed(0)}%`} />
          <StatRow label="Outstanding mortgage" value={`£${fmt(outstandingMortgage)}`} />
          <StatRow label="Equity (vs market value)" value={`£${fmt(equity)}`} />
          {property.notes_phase2 && <StatRow label="Notes" value={property.notes_phase2} />}

          {/* Capital transactions mini-list */}
          {propTxns.length > 0 && (
            <>
              <h3 style={{ fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontSize: 14, color: '#cc6600', textTransform: 'uppercase', letterSpacing: 1 }}>
                Capital Transactions
              </h3>
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

      {/* Scenarios */}
      {propScenarios.length > 0 && (
        <div style={{ background: '#111', borderRadius: 12, padding: 20, marginTop: 20 }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: 14, fontSize: 14, color: '#cc6600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Scenarios
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  {['Scenario', 'Revaluation', 'Equity Release', 'Mortgage Rate', 'Annual Rent', 'Cashflow/mo', 'ROI'].map(h => (
                    <th key={h} align={h === 'Scenario' ? 'left' : 'right'}
                      style={{ padding: '6px 10px', color: '#888', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propScenarios.map(s => {
                  const sMortgage = s.revaluation_estimate * (1 - s.deposit_pct_phase2)
                  const sMortgageInterest = sMortgage * s.mortgage_rate_phase2
                  const sNetCashIn = totalCashInvested - s.equity_release
                  const sCashflow = s.annual_rent_phase2 - annualOperatingCosts - sMortgageInterest
                  const sRoi = sNetCashIn > 0 ? (sCashflow / sNetCashIn) * 100 : 0
                  return (
                    <tr key={s.scenario_id} style={{ borderBottom: '1px solid #1e1e1e' }}>
                      <td style={{ padding: '8px 10px' }}>{s.scenario_label}</td>
                      <td align="right" style={{ padding: '8px 10px' }}>£{fmt(s.revaluation_estimate)}</td>
                      <td align="right" style={{ padding: '8px 10px' }}>£{fmt(s.equity_release)}</td>
                      <td align="right" style={{ padding: '8px 10px' }}>{(s.mortgage_rate_phase2 * 100).toFixed(1)}%</td>
                      <td align="right" style={{ padding: '8px 10px' }}>£{fmt(s.annual_rent_phase2)}</td>
                      <td align="right" style={{ padding: '8px 10px', color: sCashflow >= 0 ? '#4ade80' : '#ef4444' }}>
                        £{fmt(sCashflow / 12)}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', color: sRoi >= 10 ? '#4ade80' : sRoi >= 0 ? '#f59e0b' : '#ef4444' }}>
                        {fmtPct(sRoi)}
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
