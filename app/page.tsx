'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  // P&L calculation
  const totalIncome = data
    .filter(row => row["Item type"] === "Rent Paid")
    .reduce((sum, row) => sum + Number(row["Item amount inc VAT"]), 0)

  const totalExpenses = data
    .filter(row => row["Item type"] !== "Rent Paid")
    .reduce((sum, row) => sum + Number(row["Item amount inc VAT"]), 0)

  const net = totalIncome + totalExpenses

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      
      <h1 style={{ marginBottom: 30 }}>Lansdowne Investments – January P&L</h1>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 40 }}>
        <div>
          <h3>Total Rent</h3>
          <p style={{ fontSize: 24, color: 'green' }}>
            £{totalIncome.toFixed(2)}
          </p>
        </div>

        <div>
          <h3>Total Expenses</h3>
          <p style={{ fontSize: 24, color: 'red' }}>
            £{totalExpenses.toFixed(2)}
          </p>
        </div>

        <div>
          <h3>Net</h3>
          <p style={{ fontSize: 28, fontWeight: 'bold' }}>
            £{net.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #444' }}>
            <th align="left">Date</th>
            <th align="left">Property</th>
            <th align="left">Description</th>
            <th align="left">Type</th>
            <th align="right">Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #222' }}>
              <td>{row["Item date"]}</td>
              <td>{row["Property address"]}</td>
              <td>{row["Item description"]}</td>
              <td>{row["Item type"]}</td>
              <td align="right">
                {Number(row["Item amount inc VAT"]).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}