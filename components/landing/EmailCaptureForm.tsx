'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const INDUSTRIES = [
  'SaaS', 'Digital Agency', 'E-commerce', 'Consulting',
  'Recruitment', 'Professional Services', 'FinTech', 'HealthTech', 'Other'
]

export function EmailCaptureForm() {
  const [email, setEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    if (!email || !email.includes('@')) return
    setState('loading')
    try {
      const res = await fetch('/prospecting-os/api/landing/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, industry }),
      })
      const data = await res.json()
      if (data.success) {
        setState('success')
        setMessage(data.message)
      } else {
        setState('error')
        setMessage(data.error ?? 'Something went wrong. Try again.')
      }
    } catch {
      setState('error')
      setMessage('Network error. Try again.')
    }
  }

  return (
    <AnimatePresence mode="wait">
      {state === 'success' ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'var(--success-bg)', border: '1px solid var(--success)',
            borderRadius: 16, padding: '24px 32px', maxWidth: 480, margin: '0 auto',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>✓</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ color: 'var(--success)', fontWeight: 600, margin: '0 0 4px', fontSize: 15 }}>Report sent!</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>{message}</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, margin: '0 auto' }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                flex: 1, minWidth: 200, padding: '14px 20px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 9999, color: 'var(--text-primary)', fontSize: 15,
                outline: 'none', fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(232,66,10,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              style={{
                padding: '14px 20px', background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 9999,
                color: industry ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 14, fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
                outline: 'none', cursor: 'pointer', minWidth: 160,
              }}
            >
              <option value="">Your industry</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <motion.button
            onClick={handleSubmit}
            disabled={state === 'loading' || !email}
            whileHover={{ scale: email ? 1.02 : 1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              padding: '16px 32px', background: 'var(--accent)',
              color: 'white', border: 'none', borderRadius: 9999,
              fontSize: 15, fontWeight: 600, cursor: email ? 'pointer' : 'not-allowed',
              opacity: email ? 1 : 0.5,
              boxShadow: email ? '0 0 24px var(--accent-glow)' : 'none',
              fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
            }}
          >
            {state === 'loading' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }}
                />
                Sending...
              </span>
            ) : 'Send Me a Sample Report →'}
          </motion.button>

          {state === 'error' && (
            <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#e06060', fontSize: 13, margin: 0 }}>
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
