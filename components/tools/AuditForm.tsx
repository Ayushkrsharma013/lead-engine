'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type FormState = 'idle' | 'uploading' | 'success' | 'error'

interface FormData {
  name: string
  email: string
  company: string
  website: string
  teamSize: string
  weeklyHours: string
  currentTool: string
  icpDescription: string
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '14px 18px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 12, color: 'var(--text-primary)',
  fontSize: 14, fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

export function AuditForm() {
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<FormData>({
    name: '', email: '', company: '', website: '',
    teamSize: '', weeklyHours: '', currentTool: '', icpDescription: '',
  })

  function set(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'rgba(232,66,10,0.5)'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
  }

  async function handleSubmit() {
    if (!form.name || !form.email || !form.company) {
      setError('Name, email, and company are required.')
      return
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setState('uploading')
    setError('')

    const payload = new FormData()
    Object.entries(form).forEach(([k, v]) => payload.append(k, v))
    if (fileRef.current?.files?.[0]) {
      payload.append('csv', fileRef.current.files[0])
    }

    try {
      const res = await fetch('/prospecting-os/api/tools/audit-request', {
        method: 'POST',
        body: payload,
      })
      const data = await res.json()
      if (data.success) {
        setState('success')
      } else {
        setState('error')
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: 'center', padding: '32px 0' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28, color: '#22c55e',
          }}
        >
          ✓
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px', fontFamily: 'Cabinet Grotesk, Geist, sans-serif' }}
        >
          Audit request received
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          style={{ color: 'var(--text-secondary)', fontSize: 15, margin: '0 0 24px', lineHeight: 1.65 }}
        >
          Check your inbox — you&apos;ll receive a confirmation email shortly.
          Your scored report will be ready within{' '}
          <strong style={{ color: 'var(--text-primary)' }}>24 hours</strong>.
        </motion.p>
        <motion.a
          href="/prospecting-os/book"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}
        >
          Want results faster? Book a call →
        </motion.a>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Your name *</label>
          <input
            style={fieldStyle} placeholder="Alex Morrison"
            value={form.name} onChange={e => set('name', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Work email *</label>
          <input
            style={fieldStyle} placeholder="alex@company.com" type="email"
            value={form.email} onChange={e => set('email', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Company *</label>
          <input
            style={fieldStyle} placeholder="GrowthStack Inc"
            value={form.company} onChange={e => set('company', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Website</label>
          <input
            style={fieldStyle} placeholder="growthstack.io"
            value={form.website} onChange={e => set('website', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Sales team size</label>
          <select
            style={{ ...fieldStyle, cursor: 'pointer' }}
            value={form.teamSize} onChange={e => set('teamSize', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          >
            <option value="">Select...</option>
            {['Just me', '2–5', '6–15', '16–50', '50+'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Hours/week on prospecting</label>
          <select
            style={{ ...fieldStyle, cursor: 'pointer' }}
            value={form.weeklyHours} onChange={e => set('weeklyHours', e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
          >
            <option value="">Select...</option>
            {['Under 5 hrs', '5–10 hrs', '10–20 hrs', '20+ hrs'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Current prospecting tool (if any)</label>
        <select
          style={{ ...fieldStyle, cursor: 'pointer' }}
          value={form.currentTool} onChange={e => set('currentTool', e.target.value)}
          onFocus={handleFocus} onBlur={handleBlur}
        >
          <option value="">Select...</option>
          {['None — all manual', 'Apollo.io', 'Clay', 'Uplead', 'Apify scrapers', 'ZoomInfo', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Describe your ideal client (ICP)</label>
        <textarea
          style={{ ...fieldStyle, minHeight: 88, resize: 'vertical' } as React.CSSProperties}
          placeholder="e.g. SaaS founders and VPs of Sales at companies with 50–500 employees in the US, raising Series A/B, active on LinkedIn..."
          value={form.icpDescription} onChange={e => set('icpDescription', e.target.value)}
          onFocus={handleFocus as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
          onBlur={handleBlur as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
          Upload your prospect CSV (up to 50 contacts)
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> — optional but recommended</span>
        </label>
        <motion.div
          whileHover={{ borderColor: 'rgba(232,66,10,0.4)' }}
          transition={{ duration: 0.15 }}
          onClick={() => fileRef.current?.click()}
          style={{
            padding: '20px', border: '1px dashed var(--border)', borderRadius: 12,
            textAlign: 'center', cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <input
            ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }}
            onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
          />
          {fileName ? (
            <p style={{ color: 'var(--accent)', fontSize: 14, margin: 0, fontFamily: 'monospace' }}>
              ✓ {fileName}
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14, margin: '0 0 4px' }}>
                Click to upload CSV or Excel
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: 0 }}>
                Columns needed: Name, Title, Company, LinkedIn URL (optional)
              </p>
            </>
          )}
        </motion.div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          No CSV? No problem — we&apos;ll scrape your ICP from Apify using your description above.
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ color: '#e06060', fontSize: 13, margin: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={state === 'uploading'}
        whileHover={{ scale: 1.02, boxShadow: '0 0 32px rgba(232,66,10,0.4)' }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        style={{
          padding: '17px 0', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: 9999, fontSize: 16, fontWeight: 700,
          cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
          opacity: state === 'uploading' ? 0.7 : 1,
          boxShadow: '0 0 24px var(--accent-glow)',
          fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
          width: '100%',
        }}
      >
        {state === 'uploading' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }}
            />
            Submitting audit request...
          </span>
        ) : 'Submit My Free Audit Request →'}
      </motion.button>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
        We review every request manually. Capped at 5 per week to ensure quality.
      </p>
    </div>
  )
}
