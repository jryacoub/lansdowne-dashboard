'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend)

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
const fmtPct = (n: number) => n.toFixed(1) + '%'

interface SliderDef {
  key: string; label: string; min: number; max: number; step: number; unit: string; toDisplay: (v: number) => string
}

const SLIDERS: SliderDef[] = [
  { key: 'annualRent', label: 'Annual Rent', min: 0, max: 30000, step: 250, unit: '£', toDisplay: v => `£${fmt(v)}` },
  { key: 'mortgageRate', label: 'Mortgage Rate', min: 0, max: 0.12, step: 0.0025, unit: '%', toDisplay: v => `${(v * 100).toFixed(2)}%` },
  { key: 'depositPct', label: 'Deposit %', min: 0, max: 0.5, step: 0.01, unit: '%', toDisplay: v => `${(v * 100).toFixed(0)}%` },
  { key: 'revaluation', label: 'Revaluation', min: 50000, max: 500000, step: 5000, unit: '£', toDisplay: v => `£${fmt(v)}` },
  { key: 'voidWeeks', label: 'Void Weeks', min: 0, max: 12, step: 1, unit: 'wks', toDisplay: v => `${v} wks` },
]

function computeMetrics(p: any, overrides: Record<string, number>) {
  const annualRent = overrides.annualRent ?? (p.annual_rent_phase2 || 0)
  const mortgageRate = overrides.mortgageRate ?? (p.mortgage_rate_phase2 || 0)
  const depositPct = overrides.depositPct ?? (p.deposit_pct_phase2 || 0)
  const revaluation = overrides.revaluation ?? (p.revaluation_estimate || 0)
  const voidWeeks = overrides.voidWeeks ?? 0

  const totalCash = (p.cash_deposit_phase1 || 0) + (p.stamp_duty || 0) + (p.solicitor_fees || 0) +
    (p.agent_fee || 0) + (p.renovation_cost || 0) + (p.renovation_mgmt_fee || 0)
  const netCash = totalCash - (p.equity_release || 0)
  const mortgage = revaluation * (1 - depositPct)
  const mortgageInterest = mortgage * mortgageRate
  const opCosts = (p.management_phase2 || 0) + (p.provision_costs_phase2 || 0) +
    (p.provision_voids_phase2 || 0) + (p.bills_phase2 || 0)
  const effectiveRent = annualRent * ((52 - voidWeeks) / 52)
  const cashflow = effectiveRent - opCosts - mortgageInterest
  const roi = netCash > 0 ? (cashflow / netCash) * 100 : 0
  const equity = (p.market_value_est || 0) - mortgage
  // Equity multiple = (current equity + annual cashflow) ÷ NET cash invested.
  // Net cash because money already pulled back via refinance shouldn't double count.
  const equityMultiple = netCash > 0 ? (equity + cashflow) / netCash : 0
  const ltv = (p.market_value_est || 0) > 0 ? (mortgage / (p.market_value_est || 1)) * 100 : 0

  return { roi, equityMultiple, cashflow, ltv, mortgage, effectiveRent }
}

export default function ScenarioWorkbench() {
  const [properties, setProperties] = useState<any[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [selectedPropId, setSelectedPropId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sliders, setSliders] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const [{ data: props }, { data: scens }] = await Promise.all([
        supabase.from('properties_master').select('*').order('property_id'),
        supabase.from('scenarios').select('*'),
      ])
      if (props) {
        setProperties(props)
        if (props.length > 0) {
          setSelectedPropId(props[0].property_id)
          initSliders(props[0])
        }
      }
      if (scens) setScenarios(scens)
      setLoading(false)
    }
    load()
  }, [])

  function initSliders(p: any) {
    setSliders({
      annualRent: p.annual_rent_phase2 || 0,
      mortgageRate: p.mortgage_rate_phase2 || 0,
      depositPct: p.deposit_pct_phase2 || 0,
      revaluation: p.revaluation_estimate || 0,
      voidWeeks: 0,
    })
  }

  function onPropertyChange(propId: string) {
    setSelectedPropId(propId)
    const p = properties.find(x => x.property_id === propId)
    if (p) initSliders(p)
  }

  const selectedProp = properties.find(p => p.property_id === selectedPropId)
  const baseMetrics = selectedProp ? computeMetrics(selectedProp, {
    annualRent: selectedProp.annual_rent_phase2 || 0,
    mortgageRate: selectedProp.mortgage_rate_phase2 || 0,
    depositPct: selectedProp.deposit_pct_phase2 || 0,
    revaluation: selectedProp.revaluation_estimate || 0,
    voidWeeks: 0,
  }) : null
  const scenarioMetrics = selectedProp ? computeMetrics(selectedProp, sliders) : null

  // Monte Carlo
  const mcHistogram = useMemo(() => {
    if (!selectedProp) return null
    const N = 2000
    const rois: number[] = []
    for (let i = 0; i < N; i++) {
      const rentJitter = sliders.annualRent * (0.85 + Math.random() * 0.3)
      const rateJitter = sliders.mortgageRate * (0.8 + Math.random() * 0.5)
      const voidJitter = Math.floor(Math.random() * (sliders.voidWeeks + 4))
      const revalJitter = sliders.revaluation * (0.85 + Math.random() * 0.3)
      const m = computeMetrics(selectedProp, {
        annualRent: rentJitter,
        mortgageRate: rateJitter,
        depositPct: sliders.depositPct,
        revaluation: revalJitter,
        voidWeeks: voidJitter,
      })
      rois.push(m.roi)
    }

    // Build histogram bins
    const minRoi = Math.min(...rois)
    const maxRoi = Math.max(...rois)
    const binCount = 25
    const binWidth = (maxRoi - minRoi) / binCount || 1
    const bins = Array.from({ length: binCount }, (_, i) => ({
      label: `${(minRoi + i * binWidth).toFixed(0)}%`,
      count: 0,
      start: minRoi + i * binWidth,
    }))
    for (const r of rois) {
      const idx = Math.min(Math.floor((r - minRoi) / binWidth), binCount - 1)
      bins[idx].count++
    }

    const meanRoi = rois.reduce((a, b) => a + b, 0) / N
    const p5 = rois.sort((a, b) => a - b)[Math.floor(N * 0.05)]
    const p95 = rois[Math.floor(N * 0.95)]

    return { bins, meanRoi, p5, p95 }
  }, [selectedProp, sliders])

  // Stress tests
  const stressTests = useMemo(() => {
    if (!selectedProp || !baseMetrics) return []
    return [
      { label: 'Rate +100bps', overrides: { ...sliders, mortgageRate: sliders.mortgageRate + 0.01 } },
      { label: 'Rate +200bps', overrides: { ...sliders, mortgageRate: sliders.mortgageRate + 0.02 } },
      { label: 'Rent -5%', overrides: { ...sliders, annualRent: sliders.annualRent * 0.95 } },
      { label: 'Rent -10%', overrides: { ...sliders, annualRent: sliders.annualRent * 0.90 } },
      { label: '6 Void Weeks', overrides: { ...sliders, voidWeeks: 6 } },
      { label: 'Valuation -10%', overrides: { ...sliders, revaluation: sliders.revaluation * 0.90 } },
    ].map(s => {
      const m = computeMetrics(selectedProp, s.overrides)
      return { label: s.label, roi: m.roi, cashflow: m.cashflow, delta: m.roi - (baseMetrics?.roi || 0) }
    })
  }, [selectedProp, sliders, baseMetrics])

  // Saved scenarios for property
  const propScenarios = scenarios.filter(s => s.property_id === selectedPropId)

  if (loading) return (
    <div style={{ padding: 48, color: TEXT3, fontSize: 13, fontFamily: FONT }}>Loading scenarios…</div>
  )

  const barData = mcHistogram ? {
    labels: mcHistogram.bins.map(b => b.label),
    datasets: [{
      label: 'Frequency',
      data: mcHistogram.bins.map(b => b.count),
      backgroundColor: mcHistogram.bins.map(b => b.start + (mcHistogram.bins[1]?.start - mcHistogram.bins[0]?.start) / 2 >= 0
        ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'),
      borderRadius: 2,
    }],
  } : null

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Property selector */}
      <div style={{ marginBottom: 24 }}>
        <select
          value={selectedPropId}
          onChange={e => onPropertyChange(e.target.value)}
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

      {/* Sliders + Live metrics */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {/* Sliders */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '20px 24px' }}>
          {/* Saved scenario presets */}
          {propScenarios.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 8 }}>
                Saved Presets · {propScenarios.length} on file
              </div>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 10, lineHeight: 1.5 }}>
                Click to load into the sliders below.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {propScenarios.map((s) => (
                  <button
                    key={s.scenario_id}
                    onClick={() => setSliders({
                      annualRent: Number(s.annual_rent_phase2 || selectedProp?.annual_rent_phase2 || 0),
                      mortgageRate: Number(s.mortgage_rate_phase2 || selectedProp?.mortgage_rate_phase2 || 0.05),
                      depositPct: Number(s.deposit_pct_phase2 || selectedProp?.deposit_pct_phase2 || 0.25),
                      revaluation: Number(s.revaluation_estimate || selectedProp?.revaluation_estimate || 0),
                      voidWeeks: 0,
                    })}
                    style={{
                      padding: '6px 14px', fontSize: 11, fontWeight: 600,
                      border: `1px solid ${BORDER2}`, background: 'transparent',
                      color: TEXT2, borderRadius: 3, cursor: 'pointer',
                      fontFamily: FONT, letterSpacing: '0.5px',
                    }}
                  >
                    {s.scenario_label || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 20 }}>
            Scenario Parameters
          </div>
          {SLIDERS.map(s => (
            <div key={s.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: TEXT2 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {s.toDisplay(sliders[s.key] ?? 0)}
                </span>
              </div>
              <input
                type="range"
                min={s.min} max={s.max} step={s.step}
                value={sliders[s.key] ?? 0}
                onChange={e => setSliders(prev => ({ ...prev, [s.key]: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>

        {/* Live metrics vs base */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scenarioMetrics && baseMetrics && [
            { label: 'ROI', scenario: fmtPct(scenarioMetrics.roi), base: fmtPct(baseMetrics.roi), delta: scenarioMetrics.roi - baseMetrics.roi, good: scenarioMetrics.roi > baseMetrics.roi },
            { label: 'Equity Multiple', scenario: `${scenarioMetrics.equityMultiple.toFixed(2)}x`, base: `${baseMetrics.equityMultiple.toFixed(2)}x`, delta: scenarioMetrics.equityMultiple - baseMetrics.equityMultiple, good: scenarioMetrics.equityMultiple > baseMetrics.equityMultiple },
            { label: 'Annual Cashflow', scenario: `£${fmt(scenarioMetrics.cashflow)}`, base: `£${fmt(baseMetrics.cashflow)}`, delta: scenarioMetrics.cashflow - baseMetrics.cashflow, good: scenarioMetrics.cashflow > baseMetrics.cashflow },
            { label: 'LTV', scenario: fmtPct(scenarioMetrics.ltv), base: fmtPct(baseMetrics.ltv), delta: scenarioMetrics.ltv - baseMetrics.ltv, good: scenarioMetrics.ltv < baseMetrics.ltv },
          ].map((m, i) => (
            <div key={i} style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
              padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 6 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {m.scenario}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4 }}>Base: {m.base}</div>
                <div style={{
                  fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: m.delta === 0 ? TEXT3 : m.good ? GREEN : RED,
                }}>
                  {m.delta > 0 ? '+' : ''}{m.label === 'Annual Cashflow' ? `£${fmt(m.delta)}` : m.delta.toFixed(2)}{m.label.includes('%') || m.label === 'ROI' || m.label === 'LTV' ? 'pp' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monte Carlo + Stress Tests */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {/* Monte Carlo histogram */}
        <div style={{ flex: 2, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '20px 24px' }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 4 }}>
            Monte Carlo ROI Distribution (2,000 paths)
          </div>
          {mcHistogram && (
            <>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 16 }}>
                Mean: <span style={{ color: TEXT, fontWeight: 600 }}>{fmtPct(mcHistogram.meanRoi)}</span>
                {' · '}P5: <span style={{ color: RED, fontWeight: 600 }}>{fmtPct(mcHistogram.p5)}</span>
                {' · '}P95: <span style={{ color: GREEN, fontWeight: 600 }}>{fmtPct(mcHistogram.p95)}</span>
              </div>
              {barData && (
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                      x: { ticks: { color: TEXT3, font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
                      y: { ticks: { color: TEXT3, font: { size: 10 } }, grid: { color: BORDER } },
                    },
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: SURFACE, titleColor: TEXT2, bodyColor: TEXT, borderColor: BORDER2, borderWidth: 1 } },
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Stress tests */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 12 }}>
            Stress Tests
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stressTests.map((s, i) => (
              <div key={i} style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
                padding: '12px 16px',
              }}>
                <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6, fontWeight: 600 }}>{s.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: s.roi >= 0 ? TEXT : RED, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPct(s.roi)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.delta < 0 ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>
                    {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}pp
                  </span>
                </div>
                <div style={{ fontSize: 10, color: TEXT3, marginTop: 2 }}>
                  Cashflow: £{fmt(s.cashflow)}/yr
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Saved scenarios from DB */}
      {propScenarios.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
              Saved Scenarios
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Label', 'Revaluation', 'Deposit %', 'Equity Release', 'Rate', 'Rent'].map(h => (
                    <th key={h} align="left" style={{
                      position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
                      padding: '9px 12px', fontWeight: 600, fontSize: 10, color: TEXT3,
                      textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `1px solid ${BORDER2}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propScenarios.map((s, idx) => (
                  <tr key={s.scenario_id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: GOLD, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{s.scenario_label}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.revaluation_estimate || 0)}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>{((s.deposit_pct_phase2 || 0) * 100).toFixed(0)}%</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.equity_release || 0)}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>{((s.mortgage_rate_phase2 || 0) * 100).toFixed(2)}%</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, fontVariantNumeric: 'tabular-nums' }}>£{fmt(s.annual_rent_phase2 || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
