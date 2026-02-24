'use client'

import { useEffect, useState, useRef } from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { supabase } from '@/lib/supabase'

ChartJS.register(ArcElement, Tooltip, Legend)

// Custom Dropdown Filter component
function DropdownFilter({ options, selected, onChange, label }: { options: string[], selected: string[], onChange: (values: string[]) => void, label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggleValue(val: string) {
    const safeSelected = Array.isArray(selected) ? selected : [];
    if (safeSelected.includes(val)) {
      onChange(safeSelected.filter(v => v !== val));
    } else {
      onChange([...safeSelected, val]);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: 18 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}
        aria-label={`Filter ${label}`}
      >
        <span style={{ fontSize: 14, color: '#aaa', marginLeft: 2 }}>⏷</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 22,
          left: 0,
          minWidth: 160,
          background: '#222',
          border: '1px solid #444',
          borderRadius: 6,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          padding: 8,
          maxHeight: 220,
          overflowY: 'auto',
        }}>
          {options.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No options</div>}
          {options.map(val => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#eee', marginBottom: 2, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Array.isArray(selected) && selected.includes(val)}
                onChange={() => toggleValue(val)}
                style={{ marginRight: 6 }}
              />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{val}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters] = useState<{ [key: string]: string[] }>({})
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
      if (!error && data) {
        setData(data)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  // Calculations for summary and breakdown
  const totalIncome = data
    .filter(row => row["Item type"] === "Rent Paid")
    .reduce((sum, row) => sum + Number(row["Item amount inc VAT"]), 0)

  const totalExpenses = data
    .filter(row => row["Item type"] !== "Rent Paid")
    .reduce((sum, row) => sum + Number(row["Item amount inc VAT"]), 0)

  const net = totalIncome + totalExpenses

  const totalsByType = data.reduce((acc: any, row: any) => {
    const type = row["Item type"]
    const amount = Number(row["Item amount inc VAT"]) || 0
    if (!acc[type]) acc[type] = 0
    acc[type] += amount
    return acc
  }, {})

  const breakdownRows = Object.entries(totalsByType).map(
    ([type, total]: any) => ({ type, total })
  )

  // Filtering logic for bottom table
  let filteredData = [...data]
  // Date range filter
  if (startDate) {
    filteredData = filteredData.filter(row => row["Item date"] >= startDate)
  }
  if (endDate) {
    filteredData = filteredData.filter(row => row["Item date"] <= endDate)
  }
  Object.entries(filters).forEach(([key, selected]) => {
    if (selected && selected.length > 0) {
      filteredData = filteredData.filter(row => selected.includes(String(row[key])))
    }
  })

  // Sorting logic for bottom table
  let sortedData = [...filteredData]
  if (sortConfig) {
    sortedData.sort((a, b) => {
      const { key, direction } = sortConfig
      let aValue = a[key]
      let bValue = b[key]
      // Numeric sort for amount
      if (key === 'Item amount inc VAT') {
        aValue = Number(aValue)
        bValue = Number(bValue)
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
  }

  function getUnique(key: string) {
    return Array.from(new Set(data.map(row => String(row[key])))).sort();
  }
  function handleFilterChange(key: string, values: string[]) {
    setFilters(f => ({ ...f, [key]: values }));
  }

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1 style={{
        marginBottom: 30,
        fontWeight: 'bold',
        fontSize: 38,
        color: '#cc6600', // Darker burnt orange color
        letterSpacing: 1,
        textShadow: '0 2px 16px rgba(204,102,0,0.18)',
        lineHeight: 1.1
      }}>
        Lansdowne Investments - P&L
      </h1>
      {/* Date Range Filters */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <label style={{ color: '#eee', fontWeight: 500 }}>
          Start Date:
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ marginLeft: 8, background: '#181818', color: 'white', border: '1px solid #333', borderRadius: 6, padding: 6 }}
          />
        </label>
        <label style={{ color: '#eee', fontWeight: 500 }}>
          End Date:
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ marginLeft: 8, background: '#181818', color: 'white', border: '1px solid #333', borderRadius: 6, padding: 6 }}
          />
        </label>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 40 }}>
        <div style={{ background: '#111', padding: 20, borderRadius: 12, minWidth: 220 }}>
          <h3 style={{ fontWeight: 'bold' }}>Total Rent</h3>
          <p style={{ fontSize: 24, color: '#4ade80', fontWeight: 'bold' }}>
            £{totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div style={{ background: '#111', padding: 20, borderRadius: 12, minWidth: 220 }}>
          <h3 style={{ fontWeight: 'bold' }}>Total Expenses</h3>
          <p style={{ fontSize: 24, color: 'red', fontWeight: 'bold' }}>
            £{totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div style={{ background: '#111', padding: 20, borderRadius: 12, minWidth: 220 }}>
          <h3 style={{ fontWeight: 'bold' }}>Net</h3>
          <p style={{ fontSize: 28, fontWeight: 'bold' }}>
            £{net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 24, width: '100%' }}>
        {/* Breakdown by Type Table */}
        <div style={{ background: '#111', borderRadius: 12, padding: 20, flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 12, fontWeight: 'bold' }}>Breakdown by Type</h2>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: 'transparent',
            borderRadius: 8
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th align="left" style={{ padding: '8px 2px 8px 8px', fontWeight: 'bold' }}>Type</th>
                <th align="right" style={{ padding: 8, fontWeight: 'bold' }}>Total (£)</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row) => (
                <tr key={row.type} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '8px 2px 8px 8px' }}>{row.type}</td>
                  <td align="right" style={{ padding: 8 }}>
                    {row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #444', fontWeight: 'bold', background: '#181818' }}>
                <td style={{ padding: '8px 2px 8px 8px' }}>Total</td>
                <td align="right" style={{ padding: 8 }}>
                  {breakdownRows.reduce((sum, row) => sum + row.total, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Fees, Disbursements & Utilities Pie Chart */}
        <div style={{ background: '#111', borderRadius: 12, padding: 20, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
          <h2 style={{ marginBottom: 12, fontWeight: 'bold', textAlign: 'center', width: '100%' }}>Breakdown by Type (Excl. Rent)</h2>
          {(() => {
            const filteredBreakdown = breakdownRows.filter(row => row.type !== 'Rent Paid');
            const chartData = {
              labels: filteredBreakdown.map(row => row.type),
              datasets: [{
                data: filteredBreakdown.map(row => Math.abs(row.total)),
                backgroundColor: ['#ff6b6b', '#4ecdc4', '#ffa500'],
                borderColor: '#222',
                borderWidth: 2,
              }]
            };
            return <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#eee', font: { size: 12 } } } } }} style={{ maxWidth: 260 }} />;
          })()}
        </div>
      </div>

      <div style={{
        marginTop: 40,
        background: '#111',
        borderRadius: 12,
        padding: 20,
        maxHeight: 400,
        overflowY: 'auto',
        width: '100%'
      }}>
        <h2 style={{ marginBottom: 12, fontWeight: 'bold' }}>Property Breakdown</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #444' }}>
              <th
                align="left"
                style={{ position: 'sticky', top: 0, background: '#111', zIndex: 2, fontWeight: 'bold', cursor: 'pointer', minWidth: 100 }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <span onClick={() => setSortConfig(sortConfig?.key === 'Item date' ? { key: 'Item date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'Item date', direction: 'asc' })} style={{ userSelect: 'none' }}>
                    Date {sortConfig?.key === 'Item date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </span>
                  <DropdownFilter
                    options={getUnique('Item date')}
                    selected={filters['Item date']}
                    onChange={vals => handleFilterChange('Item date', vals)}
                    label="Date"
                  />
                </div>
              </th>
              <th
                align="left"
                style={{ position: 'sticky', top: 0, background: '#111', zIndex: 2, fontWeight: 'bold', cursor: 'pointer', minWidth: 120 }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <span onClick={() => setSortConfig(sortConfig?.key === 'Property address' ? { key: 'Property address', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'Property address', direction: 'asc' })} style={{ userSelect: 'none' }}>
                    Property {sortConfig?.key === 'Property address' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </span>
                  <DropdownFilter
                    options={getUnique('Property address')}
                    selected={filters['Property address']}
                    onChange={vals => handleFilterChange('Property address', vals)}
                    label="Property"
                  />
                </div>
              </th>
              <th
                align="left"
                style={{ position: 'sticky', top: 0, background: '#111', zIndex: 2, fontWeight: 'bold', cursor: 'pointer', minWidth: 120 }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <span onClick={() => setSortConfig(sortConfig?.key === 'Item description' ? { key: 'Item description', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'Item description', direction: 'asc' })} style={{ userSelect: 'none' }}>
                    Description {sortConfig?.key === 'Item description' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </span>
                  <DropdownFilter
                    options={getUnique('Item description')}
                    selected={filters['Item description']}
                    onChange={vals => handleFilterChange('Item description', vals)}
                    label="Description"
                  />
                </div>
              </th>
              <th
                align="left"
                style={{ width: 90, position: 'sticky', top: 0, background: '#111', zIndex: 2, fontWeight: 'bold', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <span onClick={() => setSortConfig(sortConfig?.key === 'Item type' ? { key: 'Item type', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'Item type', direction: 'asc' })} style={{ userSelect: 'none' }}>
                    Type {sortConfig?.key === 'Item type' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </span>
                  <DropdownFilter
                    options={getUnique('Item type')}
                    selected={filters['Item type']}
                    onChange={vals => handleFilterChange('Item type', vals)}
                    label="Type"
                  />
                </div>
              </th>
              <th
                align="right"
                style={{ position: 'sticky', top: 0, background: '#111', zIndex: 2, fontWeight: 'bold', cursor: 'pointer', minWidth: 90 }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <span onClick={() => setSortConfig(sortConfig?.key === 'Item amount inc VAT' ? { key: 'Item amount inc VAT', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: 'Item amount inc VAT', direction: 'asc' })} style={{ userSelect: 'none' }}>
                    Amount (£) {sortConfig?.key === 'Item amount inc VAT' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                  </span>
                  <DropdownFilter
                    options={getUnique('Item amount inc VAT')}
                    selected={filters['Item amount inc VAT']}
                    onChange={vals => handleFilterChange('Item amount inc VAT', vals)}
                    label="Amount"
                  />
                </div>
              </th>
            </tr>
          </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #222' }}>
              <td>{row['Item date']}</td>
              <td>{row['Property address']}</td>
              <td>{row['Item description']}</td>
              <td style={{ width: 90 }}>{row['Item type']}</td>
              <td align="right">
                {Number(row['Item amount inc VAT']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
        {/* Totals row for breakdown table */}
        <tfoot>
          <tr style={{ borderTop: '2px solid #444', fontWeight: 'bold', background: '#181818' }}>
            <td style={{ padding: '8px 2px 8px 8px' }}>Total</td>
            <td align="right" style={{ padding: 8 }}>
              {breakdownRows.reduce((sum, row) => sum + row.total, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </td>
          </tr>
        </tfoot>
        </table>
      </div>
    </div>
  )
}