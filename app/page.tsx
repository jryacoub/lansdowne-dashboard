'use client'

import { useEffect, useState, useRef } from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { supabase } from '@/lib/supabase'
import PropertySelector from '@/components/PropertySelector'
import PasswordGate from '@/components/PasswordGate'

ChartJS.register(ArcElement, Tooltip, Legend)

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG       = '#070c14'
const SURFACE  = '#0c1322'
const SURFACE2 = '#111927'
const BORDER   = '#1c2535'
const BORDER2  = '#243045'
const GOLD     = '#c9a842'
const BLUE     = '#4a9eff'
const GREEN    = '#22c55e'
const RED      = '#ef4444'
const TEXT     = '#dde2ed'
const TEXT2    = '#8e9ab5'
const TEXT3    = '#4a5570'
const FONT     = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── Dropdown Filter ──────────────────────────────────────────────────────────
function DropdownFilter({ options, selected, onChange, label }: {
  options: string[], selected: string[], onChange: (values: string[]) => void, label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    else document.removeEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggleValue(val: string) {
    const safe = Array.isArray(selected) ? selected : []
    onChange(safe.includes(val) ? safe.filter(v => v !== val) : [...safe, val])
  }

  const hasFilter = Array.isArray(selected) && selected.length > 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: 14 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px',
          color: hasFilter ? GOLD : TEXT3, fontSize: 9, lineHeight: 1, display: 'flex', alignItems: 'center',
        }}
        aria-label={`Filter ${label}`}
      >
        ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 22, left: 0, minWidth: 190,
          background: SURFACE, border: `1px solid ${BORDER2}`,
          borderRadius: 4, zIndex: 100,
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          padding: '4px 0', maxHeight: 260, overflowY: 'auto',
        }}>
          {options.length === 0 && (
            <div style={{ color: TEXT3, fontSize: 12, padding: '8px 14px' }}>No options</div>
          )}
          {options.map(val => (
            <label key={val} style={{
              display: 'flex', alignItems: 'center', fontSize: 12, color: TEXT2,
              padding: '5px 14px', cursor: 'pointer',
              background: (Array.isArray(selected) && selected.includes(val))
                ? 'rgba(201,168,66,0.08)' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={Array.isArray(selected) && selected.includes(val)}
                onChange={() => toggleValue(val)}
                style={{ marginRight: 8, accentColor: GOLD, width: 12, height: 12 }}
              />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                {val}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sortable column header ───────────────────────────────────────────────────
function ColHeader({
  children, colKey, sortConfig, setSortConfig, align = 'left', style = {}
}: any) {
  const active = sortConfig?.key === colKey
  return (
    <th
      align={align}
      style={{
        position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
        padding: '9px 10px 9px 10px', fontWeight: 600, fontSize: 10,
        color: active ? GOLD : TEXT3, textTransform: 'uppercase', letterSpacing: '1.2px',
        cursor: 'pointer', userSelect: 'none', borderBottom: `1px solid ${BORDER2}`,
        ...style,
      }}
    >
      {children}
      {active && <span style={{ marginLeft: 4, color: GOLD }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState<any[]>([])
  const [allProperties, setAllProperties] = useState<{ property_id: string; address: string; city: string }[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters] = useState<{ [key: string]: string[] }>({})
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [starlingTxns, setStarlingTxns] = useState<any[]>([])
  const [starlingStatusFilter, setStarlingStatusFilter] = useState('All')

  useEffect(() => {
    async function fetchData() {
      const [{ data: txns }, { data: props }, { data: starling }] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('properties_master').select('property_id, address, city').order('property_id'),
        supabase.from('starling_transactions').select('*').order('date', { ascending: false }),
      ])
      if (txns) setData(txns)
      if (props) {
        setAllProperties(props)
        if (props.length > 0) setSelectedPropertyId(props[0].property_id)
      }
      if (starling) setStarlingTxns(starling)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return (
    <div style={{ padding: 48, fontFamily: FONT, background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: 'pulse 1s infinite' }} />
      <span style={{ color: TEXT3, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>Loading portfolio data</span>
    </div>
  )

  // ─── Filtering & Sorting ───────────────────────────────────────────────────
  // Apply property + date filters first — affects everything including KPI cards
  let filteredData = [...data]
  if (selectedPropertyId) {
    const selProp = allProperties.find(p => p.property_id === selectedPropertyId)
    if (selProp) {
      const addrKey = selProp.address.split(',')[0].trim().toLowerCase()
      filteredData = filteredData.filter(row =>
        String(row['Property address'] || '').toLowerCase().includes(addrKey)
      )
    }
  }
  if (startDate) filteredData = filteredData.filter(row => row['Item date'] >= startDate)
  if (endDate) filteredData = filteredData.filter(row => row['Item date'] <= endDate)
  Object.entries(filters).forEach(([key, selected]) => {
    if (selected && selected.length > 0)
      filteredData = filteredData.filter(row => selected.includes(String(row[key])))
  })

  // ─── Calculations (on filtered data) ──────────────────────────────────────
  const totalIncome = filteredData
    .filter(row => row['Item type'] === 'Rent Paid')
    .reduce((sum, row) => sum + Number(row['Item amount inc VAT']), 0)

  const totalExpenses = filteredData
    .filter(row => row['Item type'] !== 'Rent Paid')
    .reduce((sum, row) => sum + Number(row['Item amount inc VAT']), 0)

  const net = totalIncome + totalExpenses
  const netMarginPct = totalIncome > 0 ? (net / totalIncome) * 100 : 0

  const totalsByType = filteredData.reduce((acc: any, row: any) => {
    const type = row['Item type']
    const amount = Number(row['Item amount inc VAT']) || 0
    if (!acc[type]) acc[type] = 0
    acc[type] += amount
    return acc
  }, {})

  const breakdownRows = Object.entries(totalsByType)
    .map(([type, total]: any) => ({ type, total }))
    .sort((a, b) => b.total - a.total)

  let sortedData = [...filteredData]
  if (sortConfig) {
    sortedData.sort((a, b) => {
      const { key, direction } = sortConfig
      let aVal = a[key], bVal = b[key]
      if (key === 'Item amount inc VAT') { aVal = Number(aVal); bVal = Number(bVal) }
      else if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase() }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }

  function getUnique(key: string) {
    return Array.from(new Set(data.map(row => String(row[key])))).sort()
  }
  function handleFilterChange(key: string, values: string[]) {
    setFilters(f => ({ ...f, [key]: values }))
  }
  function toggleSort(key: string) {
    setSortConfig(s => s?.key === key
      ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' }
    )
  }

  const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 })

  // ─── Pie data ──────────────────────────────────────────────────────────────
  const expenseBreakdown = breakdownRows.filter(row => row.type !== 'Rent Paid')
  const pieData = {
    labels: expenseBreakdown.map(r => r.type),
    datasets: [{
      data: expenseBreakdown.map(r => Math.abs(r.total)),
      backgroundColor: ['#ef4444', '#4a9eff', '#c9a842', '#22c55e', '#a78bfa', '#f59e0b'],
      borderColor: SURFACE,
      borderWidth: 2,
      hoverBorderColor: BORDER2,
    }],
  }

  const inputStyle: React.CSSProperties = {
    background: SURFACE, color: TEXT, border: `1px solid ${BORDER2}`,
    borderRadius: 3, padding: '6px 10px', fontSize: 12, fontFamily: FONT,
    outline: 'none', letterSpacing: '0.5px',
  }

  return (
    <PasswordGate>
    <div style={{ padding: '36px 48px', fontFamily: FONT, background: BG, minHeight: '100vh', color: TEXT }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 40, paddingBottom: 24, borderBottom: `1px solid ${BORDER}`,
      }}>
        <div>
          <div style={{ fontSize: 10, color: GOLD, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
            Lansdowne Investments
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1 }}>
            Portfolio Performance
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: TEXT3, letterSpacing: '0.5px', marginBottom: 4 }}>
            AS OF 27 FEB 2026
          </div>
          <div style={{ fontSize: 12, color: TEXT2 }}>9 Properties · Leeds & Kent</div>
        </div>
      </div>

      {/* ── UNIFIED FILTER BAR ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', marginBottom: 36,
        padding: '12px 18px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
          Filters
        </span>
        {/* Property selector */}
        <select
          value={selectedPropertyId}
          onChange={e => setSelectedPropertyId(e.target.value)}
          style={{
            background: SURFACE2, color: selectedPropertyId ? TEXT : TEXT2,
            border: `1px solid ${selectedPropertyId ? GOLD : BORDER2}`,
            borderRadius: 3, padding: '6px 32px 6px 12px', fontSize: 12,
            fontFamily: FONT, cursor: 'pointer', minWidth: 260, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a5570'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', outline: 'none',
          }}
        >
          {allProperties.map(p => (
            <option key={p.property_id} value={p.property_id}>{p.address}, {p.city}</option>
          ))}
          <option value="">All Properties</option>
        </select>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: BORDER2, margin: '0 4px' }} />

        {/* Date range */}
        <span style={{ fontSize: 12, color: TEXT3 }}>From</span>
        <input
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={inputStyle}
        />
        <span style={{ fontSize: 12, color: TEXT3 }}>To</span>
        <input
          type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={inputStyle}
        />

        {/* Clear */}
        {(selectedPropertyId || startDate || endDate) && (
          <button
            onClick={() => { setSelectedPropertyId(''); setStartDate(''); setEndDate('') }}
            style={{
              background: 'none', border: `1px solid ${BORDER2}`, color: TEXT3,
              borderRadius: 3, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Clear all
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 11, color: TEXT3 }}>
          {filteredData.length} transactions
        </div>
      </div>

      {/* ── PROPERTY ANALYSIS ───────────────────────────────────────────── */}
      <PropertySelector
        selectedId={selectedPropertyId}
        onSelectId={setSelectedPropertyId}
      />

      {/* ── SECTION DIVIDER ─────────────────────────────────────────────── */}
      <div style={{ margin: '52px 0 36px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 3, height: 18, background: GOLD, borderRadius: 2 }} />
        <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>
          P&L Summary
        </span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>

      {/* ── SUMMARY KPI CARDS ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {/* Total Rent */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GREEN}`,
          borderRadius: 4, padding: '18px 22px', flex: 1,
        }}>
          <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 10, fontWeight: 600 }}>
            Rental Income
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: GREEN, letterSpacing: '-0.5px', lineHeight: 1 }}>
            £{fmt(totalIncome)}
          </div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 8 }}>
            Gross rent collected
          </div>
        </div>

        {/* Total Expenses */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${RED}`,
          borderRadius: 4, padding: '18px 22px', flex: 1,
        }}>
          <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 10, fontWeight: 600 }}>
            Total Expenses
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: RED, letterSpacing: '-0.5px', lineHeight: 1 }}>
            -£{fmt(Math.abs(totalExpenses))}
          </div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 8 }}>
            Operating & maintenance costs
          </div>
        </div>

        {/* Net */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`,
          borderRadius: 4, padding: '18px 22px', flex: 1,
        }}>
          <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 10, fontWeight: 600 }}>
            Net P&L
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: net >= 0 ? GREEN : RED, letterSpacing: '-0.5px', lineHeight: 1 }}>
            £{fmt(net)}
          </div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 8 }}>
            Net margin&nbsp;
            <span style={{ color: netMarginPct >= 0 ? GREEN : RED, fontWeight: 600 }}>
              {netMarginPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── BREAKDOWN + PIE ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>

        {/* Breakdown by type table */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '20px 22px', minWidth: 300 }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 16 }}>
            Breakdown by Type
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left" style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${BORDER2}` }}>
                  Category
                </th>
                <th align="right" style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${BORDER2}` }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row) => {
                const isIncome = row.type === 'Rent Paid'
                return (
                  <tr key={row.type}>
                    <td style={{ padding: '7px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT2 }}>
                      <span style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: isIncome ? GREEN : RED, marginRight: 8, verticalAlign: 'middle',
                      }} />
                      {row.type}
                    </td>
                    <td align="right" style={{
                      padding: '7px 0', borderBottom: `1px solid ${BORDER}`,
                      fontSize: 12, fontWeight: 600, color: isIncome ? GREEN : RED,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {isIncome ? '+' : ''}£{row.total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '10px 0 0', fontSize: 12, fontWeight: 700, color: TEXT, borderTop: `1px solid ${BORDER2}` }}>
                  Net Total
                </td>
                <td align="right" style={{
                  padding: '10px 0 0', fontSize: 12, fontWeight: 700, borderTop: `1px solid ${BORDER2}`,
                  color: net >= 0 ? GREEN : RED, fontVariantNumeric: 'tabular-nums',
                }}>
                  £{breakdownRows.reduce((s, r) => s + r.total, 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Expense breakdown pie */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
          padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 16 }}>
            Expense Breakdown (excl. Rent)
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 280, width: '100%' }}>
              <Pie
                data={pieData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        color: TEXT2, font: { size: 11, family: FONT },
                        boxWidth: 10, padding: 12,
                      },
                    },
                    tooltip: {
                      backgroundColor: SURFACE,
                      titleColor: TEXT2,
                      bodyColor: TEXT,
                      borderColor: BORDER2,
                      borderWidth: 1,
                      padding: 10,
                      callbacks: {
                        label: (item: any) => ` -£${item.raw.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS TABLE ───────────────────────────────────────────── */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${BORDER2}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Transaction Ledger
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: TEXT3 }}>
            {sortedData.length} records
          </div>
        </div>

        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <ColHeader colKey="Item date" sortConfig={sortConfig} setSortConfig={setSortConfig}
                  style={{ minWidth: 100, paddingLeft: 18 }}
                  align="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort('Item date')} style={{ cursor: 'pointer' }}>Date</span>
                    <DropdownFilter options={getUnique('Item date')} selected={filters['Item date']} onChange={v => handleFilterChange('Item date', v)} label="Date" />
                  </div>
                </ColHeader>
                <ColHeader colKey="Property address" sortConfig={sortConfig} setSortConfig={setSortConfig}
                  style={{ minWidth: 140 }} align="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort('Property address')} style={{ cursor: 'pointer' }}>Property</span>
                    <DropdownFilter options={getUnique('Property address')} selected={filters['Property address']} onChange={v => handleFilterChange('Property address', v)} label="Property" />
                  </div>
                </ColHeader>
                <ColHeader colKey="Item description" sortConfig={sortConfig} setSortConfig={setSortConfig}
                  style={{ minWidth: 140 }} align="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort('Item description')} style={{ cursor: 'pointer' }}>Description</span>
                    <DropdownFilter options={getUnique('Item description')} selected={filters['Item description']} onChange={v => handleFilterChange('Item description', v)} label="Description" />
                  </div>
                </ColHeader>
                <ColHeader colKey="Item type" sortConfig={sortConfig} setSortConfig={setSortConfig}
                  style={{ width: 110 }} align="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span onClick={() => toggleSort('Item type')} style={{ cursor: 'pointer' }}>Type</span>
                    <DropdownFilter options={getUnique('Item type')} selected={filters['Item type']} onChange={v => handleFilterChange('Item type', v)} label="Type" />
                  </div>
                </ColHeader>
                <ColHeader colKey="Item amount inc VAT" sortConfig={sortConfig} setSortConfig={setSortConfig}
                  style={{ minWidth: 110, paddingRight: 18 }} align="right">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <span onClick={() => toggleSort('Item amount inc VAT')} style={{ cursor: 'pointer' }}>Amount (£)</span>
                    <DropdownFilter options={getUnique('Item amount inc VAT')} selected={filters['Item amount inc VAT']} onChange={v => handleFilterChange('Item amount inc VAT', v)} label="Amount" />
                  </div>
                </ColHeader>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => {
                const amount = Number(row['Item amount inc VAT'])
                const isIncome = amount > 0
                return (
                  <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '7px 10px 7px 18px', fontSize: 12, color: TEXT3, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                      {fmtDate(row['Item date'])}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>
                      {row['Property address']}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}` }}>
                      {row['Item description']}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                        color: isIncome ? GREEN : RED,
                        background: isIncome ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                        borderRadius: 3, padding: '2px 6px',
                      }}>
                        {row['Item type']}
                      </span>
                    </td>
                    <td align="right" style={{
                      padding: '7px 18px 7px 10px', fontSize: 12, fontWeight: 600,
                      color: isIncome ? GREEN : RED, fontVariantNumeric: 'tabular-nums',
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      {isIncome ? '+' : ''}£{Math.abs(amount).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: SURFACE2 }}>
                <td colSpan={3} style={{ padding: '10px 18px', fontSize: 11, color: TEXT3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', borderTop: `1px solid ${BORDER2}` }}>
                  Filtered Total
                </td>
                <td style={{ padding: '10px 10px', borderTop: `1px solid ${BORDER2}` }} />
                <td align="right" style={{
                  padding: '10px 18px 10px 10px', fontSize: 12, fontWeight: 700, borderTop: `1px solid ${BORDER2}`,
                  color: filteredData.reduce((s, r) => s + Number(r['Item amount inc VAT']), 0) >= 0 ? GREEN : RED,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  £{filteredData.reduce((s, r) => s + Number(r['Item amount inc VAT']), 0)
                    .toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── STARLING BANK TRANSACTIONS ───────────────────────────────────── */}
      {(() => {
        const totalIn = starlingTxns.reduce((s, r) => s + (Number(r.amount_gbp) > 0 ? Number(r.amount_gbp) : 0), 0)
        const totalOut = starlingTxns.reduce((s, r) => s + (Number(r.amount_gbp) < 0 ? Number(r.amount_gbp) : 0), 0)
        const closingBalance = starlingTxns.length > 0 ? Number(starlingTxns[0].balance_gbp) : 0
        const dates = starlingTxns.map(r => r.date).filter(Boolean).sort()
        const dateRange = dates.length > 0
          ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`
          : '—'

        const statusFilterOptions = ['All', 'Mapped', 'MSL', 'Needs Review']

        const statusFilterMap: Record<string, string> = {
          'Mapped': 'mapped',
          'MSL': 'mapped_msl',
          'Needs Review': 'needs_review',
        }

        const filteredStarling = starlingStatusFilter === 'All'
          ? starlingTxns
          : starlingTxns.filter(r => r.categorisation_status === statusFilterMap[starlingStatusFilter])

        function statusBadge(status: string | null) {
          if (!status) return <span style={{ color: TEXT3 }}>—</span>
          const styles: Record<string, { color: string; bg: string; label: string }> = {
            mapped:       { color: GREEN,   bg: 'rgba(34,197,94,0.1)',   label: 'Mapped' },
            mapped_msl:   { color: BLUE,    bg: 'rgba(74,158,255,0.1)',  label: 'MSL' },
            needs_review: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Needs Review' },
            pending:      { color: TEXT3,   bg: 'rgba(255,255,255,0.05)', label: 'Pending' },
          }
          const s = styles[status] ?? { color: TEXT3, bg: 'rgba(255,255,255,0.05)', label: status }
          return (
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
              color: s.color, background: s.bg, borderRadius: 3, padding: '2px 6px',
            }}>
              {s.label}
            </span>
          )
        }

        return (
          <>
            {/* Section divider */}
            <div style={{ margin: '52px 0 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 3, height: 18, background: GOLD, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 600 }}>
                Starling Bank Transactions
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
                color: '#070c14', background: GOLD, borderRadius: 3, padding: '2px 7px',
              }}>
                Pending Categorisation
              </span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

            <div style={{ fontSize: 12, color: TEXT3, marginBottom: 20, fontStyle: 'italic' }}>
              These transactions require allocation before being included in portfolio reporting.
            </div>

            {/* Summary bar */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 20,
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden',
            }}>
              {[
                { label: 'Transactions', value: String(starlingTxns.length), color: TEXT },
                { label: 'Date Range', value: dateRange, color: TEXT2 },
                { label: 'Total In', value: `£${totalIn.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`, color: GREEN },
                { label: 'Total Out', value: `£${Math.abs(totalOut).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`, color: RED },
                { label: 'Closing Balance', value: `£${closingBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: GOLD },
              ].map((item, i) => (
                <div key={i} style={{
                  flex: 1, padding: '14px 18px',
                  borderRight: i < 4 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <div style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 6 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '8px 14px', background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 4,
            }}>
              <span style={{ fontSize: 10, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginRight: 4 }}>
                Status
              </span>
              {statusFilterOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setStarlingStatusFilter(opt)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 3,
                    cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.5px',
                    border: `1px solid ${starlingStatusFilter === opt ? GOLD : BORDER2}`,
                    background: starlingStatusFilter === opt ? 'rgba(201,168,66,0.1)' : 'transparent',
                    color: starlingStatusFilter === opt ? GOLD : TEXT3,
                  }}
                >
                  {opt}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT3 }}>
                {filteredStarling.length} records
              </span>
            </div>

            {/* Transactions table */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[
                        { label: 'Date', right: false, pl: true },
                        { label: 'Counter Party', right: false },
                        { label: 'Reference', right: false },
                        { label: 'Type', right: false },
                        { label: 'Amount', right: true },
                        { label: 'Balance', right: true },
                        { label: 'Spending Cat.', right: false },
                        { label: 'Property', right: false },
                        { label: 'Category', right: false },
                        { label: 'Status', right: false },
                      ].map(({ label, right, pl }) => (
                        <th key={label} align={right ? 'right' : 'left'} style={{
                          position: 'sticky', top: 0, background: SURFACE2, zIndex: 2,
                          padding: pl ? '9px 10px 9px 18px' : '9px 10px',
                          fontWeight: 600, fontSize: 10, color: TEXT3,
                          textTransform: 'uppercase', letterSpacing: '1.2px',
                          borderBottom: `1px solid ${BORDER2}`,
                        }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStarling.map((row, idx) => {
                      const amt = Number(row.amount_gbp)
                      const isIn = amt >= 0
                      return (
                        <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                          <td style={{ padding: '7px 10px 7px 18px', fontSize: 12, color: TEXT3, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}` }}>
                            {row.date ? fmtDate(row.date) : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.counter_party || '—'}
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 12, color: TEXT2, borderBottom: `1px solid ${BORDER}`, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.reference || '—'}
                          </td>
                          <td style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}` }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                              color: TEXT2, background: 'rgba(255,255,255,0.05)',
                              borderRadius: 3, padding: '2px 6px',
                            }}>
                              {row.type || '—'}
                            </span>
                          </td>
                          <td align="right" style={{
                            padding: '7px 10px', fontSize: 12, fontWeight: 700,
                            color: isIn ? GREEN : RED, fontVariantNumeric: 'tabular-nums',
                            borderBottom: `1px solid ${BORDER}`,
                          }}>
                            {isIn ? '+' : ''}£{Math.abs(amt).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td align="right" style={{
                            padding: '7px 10px', fontSize: 12, color: TEXT2,
                            fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}`,
                          }}>
                            £{Number(row.balance_gbp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 12, color: row.spending_category ? GOLD : TEXT3, borderBottom: `1px solid ${BORDER}` }}>
                            {row.spending_category || <span style={{ color: TEXT3, fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 12, color: row.property_address ? TEXT2 : TEXT3, borderBottom: `1px solid ${BORDER}`, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.property_address || <span style={{ color: TEXT3 }}>—</span>}
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 12, color: row.dashboard_category ? TEXT2 : TEXT3, borderBottom: `1px solid ${BORDER}`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.dashboard_category || <span style={{ color: TEXT3 }}>—</span>}
                          </td>
                          <td style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}` }}>
                            {statusBadge(row.categorisation_status)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      })()}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: TEXT3, letterSpacing: '0.5px' }}>
          LANSDOWNE INVESTMENTS · PORTFOLIO ANALYTICS
        </span>
        <span style={{ fontSize: 10, color: TEXT3 }}>
          Data sourced from Supabase · {data.length} total transactions
        </span>
      </div>

    </div>
    </PasswordGate>
  )
}
