'use client'

import { useState } from 'react'

const BORDER = '#1c2535'
const GOLD = '#c9a842'
const TEXT = '#dde2ed'
const TEXT3 = '#4a5570'
const FONT = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

const TABS = ['Summary', 'Property Detail', 'Transactions', 'Cost Intelligence'] as const
export type TabId = (typeof TABS)[number]

export default function TabLayout({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <nav style={{
      display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`,
      marginBottom: 36,
    }}>
      {TABS.map(tab => {
        const active = tab === activeTab
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              background: 'none', border: 'none', borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
              padding: '10px 20px', cursor: 'pointer', fontFamily: FONT,
              fontSize: 12, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
              color: active ? TEXT : TEXT3,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab}
          </button>
        )
      })}
    </nav>
  )
}
