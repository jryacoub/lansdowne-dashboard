'use client'

import { useState, useEffect, FormEvent } from 'react'

const BG      = '#070c14'
const SURFACE = '#0c1322'
const BORDER  = '#1c2535'
const BORDER2 = '#243045'
const GOLD    = '#c9a842'
const TEXT    = '#dde2ed'
const TEXT2   = '#8e9ab5'
const TEXT3   = '#4a5570'
const RED     = '#ef4444'
const FONT    = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif'

const SESSION_KEY = 'lansdowne_auth'

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed]     = useState(false)
  const [checked, setChecked]   = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  // On mount, check sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthed(sessionStorage.getItem(SESSION_KEY) === 'true')
    }
    setChecked(true)
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const correct = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD
    if (password === correct) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  // Avoid flash of login screen on already-authed sessions
  if (!checked) return null

  if (authed) return <>{children}</>

  return (
    <div style={{
      minHeight: '100vh', background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, padding: 24,
    }}>
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6,
        padding: '48px 40px', width: '100%', maxWidth: 380,
      }}>
        {/* Branding */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', width: 36, height: 36, borderRadius: '50%',
            background: GOLD, marginBottom: 16,
          }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: '0.5px' }}>
            Lansdowne Investments
          </div>
          <div style={{ fontSize: 12, color: TEXT3, marginTop: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>
            Portfolio Dashboard
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: TEXT3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#111927', border: `1px solid ${error ? RED : BORDER2}`,
                borderRadius: 3, padding: '10px 14px', fontSize: 14,
                color: TEXT, fontFamily: FONT, outline: 'none',
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</div>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%', padding: '11px 0', marginTop: 8,
              background: GOLD, border: 'none', borderRadius: 3,
              fontSize: 13, fontWeight: 600, color: BG,
              fontFamily: FONT, cursor: 'pointer', letterSpacing: '0.5px',
            }}
          >
            Enter Dashboard
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: TEXT3 }}>
          Private access only
        </div>
      </div>
    </div>
  )
}
