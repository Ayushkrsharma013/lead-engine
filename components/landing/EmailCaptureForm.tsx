'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const INDUSTRIES = [
  'SaaS', 'Digital Agency', 'E-commerce', 'Consulting',
  'Recruitment', 'Professional Services', 'FinTech', 'HealthTech', 'Other'
]

function IndustryDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  useEffect(() => { setMounted(true) }, [])

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      zIndex: 50000,
    })
  }, [])

  useEffect(() => {
    if (open) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, { passive: true })
      window.addEventListener('resize', updatePosition, { passive: true })
    }
    return () => {
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const clickedBtn = btnRef.current?.contains(e.target as Node)
      const clickedList = listRef.current?.contains(e.target as Node)
      if (!clickedBtn && !clickedList) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ minWidth: 180 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 20px',
          background: 'var(--bg-card)', border: `1px solid ${open ? 'rgba(232,66,10,0.5)' : 'var(--border)'}`,
          borderRadius: 9999, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 14, fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
          outline: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color 0.15s',
        }}
      >
        {value || 'Your industry'}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
        </motion.span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={listRef}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                ...dropdownStyle,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: 6,
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {INDUSTRIES.map((ind, i) => (
                <motion.button
                  key={ind}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  whileHover={{ scale: 1.03, x: 4, transition: { duration: 0.15 } }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onChange(ind); setOpen(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: value === ind ? 'rgba(232,66,10,0.08)' : 'transparent',
                    borderRadius: 10, border: 'none',
                    color: value === ind ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 14, fontWeight: value === ind ? 600 : 400,
                    fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {ind}
                  {value === ind && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{
                        float: 'right', width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent)', display: 'inline-block', marginTop: 5,
                      }}
                    />
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

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
            <IndustryDropdown value={industry} onChange={setIndustry} />
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
