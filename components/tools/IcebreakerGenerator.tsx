'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ToolDropdown } from '@/components/tools/ToolDropdown'

type GenState = 'idle' | 'generating' | 'done' | 'error' | 'limit_reached'

interface InputData {
  prospectName: string
  prospectTitle: string
  company: string
  industry: string
  recentActivity: string
  yourOffer: string
  tone: 'professional' | 'conversational' | 'direct'
}

const TONES = [
  { value: 'professional' as const, label: 'Professional' },
  { value: 'conversational' as const, label: 'Conversational' },
  { value: 'direct' as const, label: 'Direct' },
]

const LIMIT_KEY = 'ib_gen_count'
const LIMIT_MAX = 3

function getCount(): number {
  if (typeof window === 'undefined') return 0
  try { return parseInt(localStorage.getItem(LIMIT_KEY) ?? '0', 10) }
  catch { return 0 }
}
function incrementCount() {
  try { localStorage.setItem(LIMIT_KEY, String(getCount() + 1)) }
  catch { /* quota exceeded / private browsing — silently skip */ }
}

export function IcebreakerGenerator() {
  const [state, setState] = useState<GenState>('idle')
  const [count, setCount] = useState(0)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState<InputData>({
    prospectName: '', prospectTitle: '', company: '', industry: '',
    recentActivity: '', yourOffer: '', tone: 'conversational',
  })

  useEffect(() => {
    setCount(getCount())
  }, [])

  function set<K extends keyof InputData>(field: K, value: InputData[K]) {
    setInput(prev => ({ ...prev, [field]: value }))
  }

  const limitReached = count >= LIMIT_MAX

  async function generate() {
    if (limitReached) { setState('limit_reached'); return }
    if (!input.prospectName || !input.company || !input.prospectTitle) {
      setError('Name, title, and company are required.')
      return
    }
    setState('generating')
    setError('')
    setResult('')

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('/prospecting-os/api/tools/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json()
      if (data.icebreaker) {
        setResult(data.icebreaker)
        setState('done')
        incrementCount()
        setCount(c => c + 1)
      } else if (data.error === 'rate_limit') {
        setState('limit_reached')
        setCount(LIMIT_MAX)
      } else {
        throw new Error(data.error ?? 'Generation failed')
      }
    } catch (e: unknown) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 12, color: 'var(--text-primary)',
    fontSize: 14, fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'rgba(232,66,10,0.5)'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--border)'
  }

  const showLimitState = limitReached || state === 'limit_reached'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* LEFT: Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', margin: '0 0 4px' }}>
          // Prospect info
        </p>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Prospect name *</label>
          <input style={fieldStyle} placeholder="Alex Morrison" value={input.prospectName}
            onChange={e => set('prospectName', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Their job title *</label>
          <input style={fieldStyle} placeholder="VP of Marketing" value={input.prospectTitle}
            onChange={e => set('prospectTitle', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Company *</label>
          <input style={fieldStyle} placeholder="GrowthStack Inc" value={input.company}
            onChange={e => set('company', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Industry</label>
          <ToolDropdown
            value={input.industry}
            options={['SaaS', 'Digital Agency', 'E-commerce', 'FinTech', 'HealthTech', 'Consulting', 'Recruitment', 'Other']}
            onChange={v => set('industry', v)}
            placeholder="Select industry"
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>
            Recent activity (post, news, funding, job posting...)
          </label>
          <textarea
            style={{ ...fieldStyle, minHeight: 72, resize: 'vertical' } as React.CSSProperties}
            placeholder="e.g. They just posted about scaling their CS team after a Series B. Or: Recently hired 3 SDRs."
            value={input.recentActivity}
            onChange={e => set('recentActivity', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>What you&apos;re offering</label>
          <input style={fieldStyle} placeholder="AI-powered B2B lead generation pipeline"
            value={input.yourOffer} onChange={e => set('yourOffer', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8 }}>Tone</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TONES.map(t => (
              <button
                type="button"
                key={t.value}
                onClick={() => set('tone', t.value)}
                style={{
                  padding: '7px 16px', borderRadius: 9999, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${input.tone === t.value ? 'rgba(232,66,10,0.5)' : 'var(--border)'}`,
                  background: input.tone === t.value ? 'rgba(232,66,10,0.12)' : 'transparent',
                  color: input.tone === t.value ? 'var(--accent)' : 'var(--text-tertiary)',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            {Math.max(0, LIMIT_MAX - count)} free generation{Math.max(0, LIMIT_MAX - count) !== 1 ? 's' : ''} remaining
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: LIMIT_MAX }).map((_, i) => (
              <div key={i} style={{
                width: 20, height: 4, borderRadius: 2,
                background: i < count ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>

        {error && (
          <p style={{ color: '#e06060', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <motion.button
          type="button"
          onClick={generate}
          disabled={state === 'generating' || showLimitState}
          whileHover={{ scale: (!showLimitState && state !== 'generating') ? 1.02 : 1, boxShadow: '0 0 28px rgba(232,66,10,0.4)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          style={{
            padding: '15px 0', background: showLimitState ? 'var(--bg-card)' : 'var(--accent)',
            color: showLimitState ? 'var(--text-tertiary)' : 'white',
            border: showLimitState ? '1px solid var(--border)' : 'none',
            borderRadius: 9999, fontSize: 15, fontWeight: 700,
            cursor: (state === 'generating' || showLimitState) ? 'not-allowed' : 'pointer',
            boxShadow: showLimitState ? 'none' : '0 0 20px var(--accent-glow)',
            fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
          }}
        >
          {state === 'generating' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }}
              />
              Generating...
            </span>
          ) : showLimitState ? 'Free limit reached — see options below'
          : 'Generate Icebreaker →'}
        </motion.button>
      </div>

      {/* RIGHT: Output */}
      <div>
        <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', margin: '0 0 12px' }}>
          // Output
        </p>

        <AnimatePresence mode="wait">

          {state === 'idle' && !showLimitState && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                minHeight: 280, background: 'var(--bg-card)', border: '1px dashed var(--border)',
                borderRadius: 16, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 32,
              }}
            >
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', margin: 0 }}>
                Your icebreaker will appear here.<br />
                Fill in the form and hit Generate.
              </p>
            </motion.div>
          )}

          {state === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                minHeight: 280, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}
                  />
                ))}
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
                Claude AI is reading their context...
              </p>
            </motion.div>
          )}

          {state === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'var(--bg-card)', border: '1px solid rgba(232,66,10,0.3)',
                borderRadius: 16, padding: 24,
              }}
            >
              <p style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.1em', margin: '0 0 12px', textTransform: 'uppercase' }}>
                // Generated icebreaker
              </p>
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.75, margin: '0 0 20px', fontStyle: 'italic' }}>
                &ldquo;{result}&rdquo;
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <motion.button
                  type="button"
                  onClick={copyResult}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '9px 20px', background: copied ? 'rgba(34,197,94,0.15)' : 'var(--accent)',
                    color: copied ? '#22c55e' : 'white',
                    border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none',
                    borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy to clipboard'}
                </motion.button>
                {count < LIMIT_MAX && (
                  <button
                    type="button"
                    onClick={() => { setState('idle'); setResult('') }}
                    style={{
                      padding: '9px 20px', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 9999,
                      fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                  >
                    Generate another
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {showLimitState && (
            <motion.div
              key="limit"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'var(--bg-card)', border: '1px solid rgba(232,66,10,0.25)',
                borderRadius: 16, padding: 28, textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                You&apos;ve used your 3 free generations
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.65 }}>
                Want icebreakers for your entire pipeline — 500+ leads,
                fully automated, every morning?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <motion.a
                  href="/prospecting-os/book"
                  whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(232,66,10,0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'block', background: 'var(--accent)', color: 'white',
                    padding: '13px', borderRadius: 9999, fontSize: 14, fontWeight: 700,
                    textDecoration: 'none', boxShadow: '0 0 16px var(--accent-glow)',
                  }}
                >
                  Book a Free Demo →
                </motion.a>
                <Link href="/tools/free-audit"
                  style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none' }}>
                  Or get 50 leads audited free →
                </Link>
              </div>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                minHeight: 120, background: 'rgba(224,96,96,0.08)', border: '1px solid rgba(224,96,96,0.2)',
                borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <p style={{ color: '#e06060', fontSize: 14, margin: 0, textAlign: 'center' }}>
                {error}<br />
                <button type="button" onClick={() => setState('idle')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
                  Try again →
                </button>
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
