'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const SURFACE = '#0c1322'
const SURFACE2 = '#111927'
const BORDER = '#1c2535'
const BORDER2 = '#243045'
const GOLD = '#c9a842'
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const BLUE = '#4a9eff'
const TEXT = '#dde2ed'
const TEXT2 = '#8e9ab5'
const TEXT3 = '#4a5570'
const FONT = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

const CATEGORY_REGEX: [RegExp, string][] = [
  [/insurance/i, 'Insurance'],
  [/council/i, 'Council Tax'],
  [/utilit|electric|gas|water|energy/i, 'Utilities'],
  [/mortgage|interest/i, 'Mortgage'],
  [/rent|tenant/i, 'Rent Paid'],
  [/repair|maintenance|plumb|boiler/i, 'Repairs'],
  [/manag/i, 'Management'],
  [/solicitor|legal/i, 'Legal'],
  [/cleaning|clean/i, 'Cleaning'],
]

interface Decision {
  id: string
  property_address: string | null
  dashboard_category: string | null
  status: 'approved' | 'rejected' | null
}

export default function TriageInbox() {
  const [pendingTxns, setPendingTxns] = useState<any[]>([])
  const [mappedTxns, setMappedTxns] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [persistMode, setPersistMode] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: pending }, { data: mapped }, { data: props }] = await Promise.all([
        supabase.from('starling_transactions').select('*')
          .in('categorisation_status', ['needs_review', 'pending'])
          .order('date', { ascending: false }),
        supabase.from('starling_transactions').select('*')
          .in('categorisation_status', ['mapped', 'mapped_msl']),
        supabase.from('properties_master').select('property_id, address, city').order('property_id'),
      ])
      if (pending) setPendingTxns(pending)
      if (mapped) setMappedTxns(mapped)
      if (props) setProperties(props)
      setLoading(false)
    }
    load()
  }, [])

  // Build suggestion rules from mapped transactions
  const suggestionRules = useMemo(() => {
    const counterPartyMap: Record<string, { property: string | null; category: string | null; count: number }[]> = {}

    for (const t of mappedTxns) {
      const cp = (t.counter_party || '').toLowerCase().trim()
      if (!cp) continue
      if (!counterPartyMap[cp]) counterPartyMap[cp] = []
      counterPartyMap[cp].push({
        property: t.property_address,
        category: t.dashboard_category,
        count: 1,
      })
    }

    // Aggregate counts
    const rules: Record<string, { property: string | null; category: string | null; confidence: number }> = {}
    for (const [cp, entries] of Object.entries(counterPartyMap)) {
      // Most frequent property + category
      const propCounts: Record<string, number> = {}
      const catCounts: Record<string, number> = {}
      for (const e of entries) {
        if (e.property) propCounts[e.property] = (propCounts[e.property] || 0) + 1
        if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1
      }
      const topProp = Object.entries(propCounts).sort((a, b) => b[1] - a[1])[0]
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
      const total = entries.length
      const propConf = topProp ? topProp[1] / total : 0
      const catConf = topCat ? topCat[1] / total : 0

      rules[cp] = {
        property: topProp ? topProp[0] : null,
        category: topCat ? topCat[0] : null,
        confidence: Math.min(propConf, catConf),
      }
    }
    return rules
  }, [mappedTxns])

  function getSuggestion(txn: any): { property: string | null; category: string | null; confidence: number; source: string } {
    const cp = (txn.counter_party || '').toLowerCase().trim()
    // Counter party frequency rules
    if (cp && suggestionRules[cp]) {
      const rule = suggestionRules[cp]
      return { ...rule, source: 'counter_party' }
    }
    // Regex fallback
    const text = `${txn.counter_party || ''} ${txn.reference || ''}`.toLowerCase()
    for (const [re, cat] of CATEGORY_REGEX) {
      if (re.test(text)) {
        return { property: null, category: cat, confidence: 0.4, source: 'regex' }
      }
    }
    return { property: null, category: null, confidence: 0, source: 'none' }
  }

  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const t of mappedTxns) {
      if (t.dashboard_category) cats.add(t.dashboard_category)
    }
    CATEGORY_REGEX.forEach(([, cat]) => cats.add(cat))
    return Array.from(cats).sort()
  }, [mappedTxns])

  const allPropertyAddresses = useMemo(() => {
    const addrs = new Set<string>()
    for (const t of mappedTxns) {
      if (t.property_address) addrs.add(t.property_address)
    }
    return Array.from(addrs).sort()
  }, [mappedTxns])

  function updateDecision(id: string, update: Partial<Decision>) {
    setDecisions(prev => ({
      ...prev,
      [id]: { ...prev[id], id, ...update } as Decision,
    }))
  }

  function approveWithSuggestion(txn: any) {
    const suggestion = getSuggestion(txn)
    const existing = decisions[txn.id]
    updateDecision(txn.id, {
      property_address: existing?.property_address ?? suggestion.property ?? txn.property_address,
      dashboard_category: existing?.dashboard_category ?? suggestion.category ?? txn.dashboard_category,
      status: 'approved',
    })
  }

  // Bulk approve high-confidence
  function bulkApprove() {
    const updates: Record<string, Decision> = {}
    for (const txn of pendingTxns) {
      const suggestion = getSuggestion(txn)
      if (suggestion.confidence >= 0.7) {
        updates[txn.id] = {
          id: txn.id,
          property_address: suggestion.property ?? txn.property_address,
          dashboard_category: suggestion.category ?? txn.dashboard_category,
          status: 'approved',
        }
      }
    }
    setDecisions(prev => ({ ...prev, ...updates }))
  }

  const approvedCount = Object.values(decisions).filter(d => d.status === 'approved').length
  const highConfCount = pendingTxns.filter(t => getSuggestion(t).confidence >= 0.7).length

  async function saveDecisions() {
    if (!persistMode) return
    setSaving(true)
    const approved = Object.values(decisions).filter(d => d.status === 'approved')
    for (const d of approved) {
      await supabase.from('starling_transactions').update({
        property_address: d.property_address,
        dashboard_category: d.dashboard_category,
        categorisation_status: 'mapped',
      }).eq('id', d.id)
    }
    // Remove saved from pending
    setPendingTxns(prev => prev.filter(t => !approved.find(a => a.id === t.id)))
    setDecisions({})
    setSaving(false)
  }

  if (loading) return (
    <div style={{ padding: 48, color: TEXT3, fontSize: 13, fontFamily: FONT }}>Loading triage inbox…</div>
  )

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
        padding: '14px 18px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
          Triage Inbox
        </span>
        <span style={{ fontSize: 12, color: TEXT3 }}>{pendingTxns.length} pending</span>

        <div style={{ width: 1, height: 20, background: BORDER2 }} />

        <button
          onClick={bulkApprove}
          style={{
            background: highConfCount > 0 ? 'rgba(34,197,94,0.1)' : 'transparent',
            border: `1px solid ${highConfCount > 0 ? GREEN : BORDER2}`,
            color: highConfCount > 0 ? GREEN : TEXT3, borderRadius: 3,
            padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          Bulk Approve ({highConfCount} high-conf)
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Persist toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: persistMode ? AMBER : TEXT3, fontWeight: 600 }}>
              Persist {persistMode ? 'ON' : 'OFF'}
            </span>
            <button
              onClick={() => setPersistMode(p => !p)}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: persistMode ? AMBER : BORDER2,
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: TEXT,
                position: 'absolute', top: 2,
                left: persistMode ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {persistMode && approvedCount > 0 && (
            <button
              onClick={saveDecisions}
              disabled={saving}
              style={{
                background: 'rgba(201,168,66,0.15)', border: `1px solid ${GOLD}`,
                color: GOLD, borderRadius: 3, padding: '5px 14px', fontSize: 11,
                fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: FONT,
              }}
            >
              {saving ? 'Saving…' : `Save ${approvedCount}`}
            </button>
          )}

          {!persistMode && approvedCount > 0 && (
            <span style={{ fontSize: 11, color: TEXT3, fontStyle: 'italic' }}>
              {approvedCount} approved (local only)
            </span>
          )}
        </div>
      </div>

      {/* Transaction rows */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {pendingTxns.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: TEXT3, fontSize: 13 }}>
              No transactions pending review.
            </div>
          ) : pendingTxns.map((txn, idx) => {
            const suggestion = getSuggestion(txn)
            const decision = decisions[txn.id]
            const isApproved = decision?.status === 'approved'
            const isRejected = decision?.status === 'rejected'
            const amt = Number(txn.amount_gbp || 0)

            return (
              <div key={txn.id} style={{
                padding: '12px 18px', borderBottom: `1px solid ${BORDER}`,
                background: isApproved ? 'rgba(34,197,94,0.04)' : isRejected ? 'rgba(239,68,68,0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)',
              }}>
                {/* Row 1: transaction info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: TEXT3, fontVariantNumeric: 'tabular-nums', minWidth: 80 }}>
                    {txn.date || '—'}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {txn.counter_party || '—'}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {txn.reference || '—'}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right',
                    color: amt >= 0 ? GREEN : RED,
                  }}>
                    {amt >= 0 ? '+' : ''}£{Math.abs(amt).toFixed(2)}
                  </span>

                  {/* Confidence badge */}
                  {suggestion.confidence > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', borderRadius: 3, padding: '2px 7px',
                      color: suggestion.confidence >= 0.7 ? GREEN : suggestion.confidence >= 0.4 ? AMBER : TEXT3,
                      background: suggestion.confidence >= 0.7 ? 'rgba(34,197,94,0.1)' : suggestion.confidence >= 0.4 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                    }}>
                      {(suggestion.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Row 2: dropdowns + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Property dropdown */}
                  <select
                    value={decision?.property_address ?? suggestion.property ?? ''}
                    onChange={e => updateDecision(txn.id, { property_address: e.target.value || null })}
                    style={{
                      background: SURFACE2, color: TEXT2, border: `1px solid ${BORDER2}`,
                      borderRadius: 3, padding: '4px 8px', fontSize: 11, fontFamily: FONT,
                      cursor: 'pointer', minWidth: 180, appearance: 'none', outline: 'none',
                    }}
                  >
                    <option value="">— Property —</option>
                    {allPropertyAddresses.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>

                  {/* Category dropdown */}
                  <select
                    value={decision?.dashboard_category ?? suggestion.category ?? ''}
                    onChange={e => updateDecision(txn.id, { dashboard_category: e.target.value || null })}
                    style={{
                      background: SURFACE2, color: TEXT2, border: `1px solid ${BORDER2}`,
                      borderRadius: 3, padding: '4px 8px', fontSize: 11, fontFamily: FONT,
                      cursor: 'pointer', minWidth: 140, appearance: 'none', outline: 'none',
                    }}
                  >
                    <option value="">— Category —</option>
                    {allCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {suggestion.source !== 'none' && (
                    <span style={{ fontSize: 10, color: TEXT3, fontStyle: 'italic' }}>
                      via {suggestion.source}
                    </span>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => approveWithSuggestion(txn)}
                      style={{
                        background: isApproved ? GREEN : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${GREEN}`,
                        color: isApproved ? '#070c14' : GREEN,
                        borderRadius: 3, padding: '4px 12px', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}
                    >
                      {isApproved ? 'Approved' : 'Approve'}
                    </button>
                    <button
                      onClick={() => updateDecision(txn.id, { status: 'rejected' })}
                      style={{
                        background: isRejected ? RED : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${RED}`,
                        color: isRejected ? '#070c14' : RED,
                        borderRadius: 3, padding: '4px 12px', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}
                    >
                      {isRejected ? 'Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
