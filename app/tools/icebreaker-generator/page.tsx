'use client'
import { motion } from 'framer-motion'
import { IcebreakerGenerator } from '@/components/tools/IcebreakerGenerator'

export default function IcebreakerGeneratorPage() {
  return (
    <div className="landing-page">

      {/* Hero */}
      <section style={{ padding: '80px 0 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span style={{
              display: 'inline-block', fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em',
              background: 'rgba(232,66,10,0.1)', border: '1px solid rgba(232,66,10,0.2)',
              padding: '4px 14px', borderRadius: 9999, marginBottom: 24,
              textTransform: 'uppercase',
            }}>
              // Powered by Gemini 2.5 Flash
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 'clamp(30px,5vw,50px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, margin: '0 0 18px', fontFamily: 'Cabinet Grotesk,Geist,sans-serif' }}
          >
            Write a cold email icebreaker{' '}
            <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 }}>
              that actually gets replies.
            </em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }}
          >
            Enter your prospect&apos;s info. Gemini AI reads their context and writes a
            unique, context-specific opening line — not a template.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}
          >
            3 free generations · No signup required · Results in under 5 seconds
          </motion.p>
        </div>
      </section>

      {/* Generator tool */}
      <section style={{ padding: '0 0 80px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <IcebreakerGenerator />
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section style={{ padding: '0 0 80px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', marginBottom: 32 }}>
            // How it works
          </p>
          <motion.div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { step: '01', title: 'Enter prospect context', desc: "Add their name, title, company, and any recent activity you've spotted — a post, news article, or job opening." },
              { step: '02', title: 'Gemini reads the room', desc: 'Our AI synthesizes their context and generates an opening line that references something real about them — never a template.' },
              { step: '03', title: 'Copy and send', desc: 'Your icebreaker is ready in under 5 seconds. Copy it directly into LinkedIn or your cold email tool.' },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
                }}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '24px 20px',
                }}
              >
                <span style={{
                  display: 'inline-block', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em',
                  marginBottom: 12, background: 'rgba(232,66,10,0.1)',
                  padding: '2px 10px', borderRadius: 9999,
                  border: '1px solid rgba(232,66,10,0.2)',
                }}>
                  {item.step}
                </span>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'Cabinet Grotesk, Geist, sans-serif' }}>
                  {item.title}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Upgrade CTA */}
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', fontFamily: 'Cabinet Grotesk, Geist, sans-serif' }}>
            Need this for{' '}
            <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 }}>500 leads a month?</em>
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, lineHeight: 1.65 }}>
            Prospecting OS generates personalized icebreakers for your entire pipeline automatically — every lead enriched and outreach-ready, delivered daily.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <motion.a
              href="/prospecting-os/book"
              whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(232,66,10,0.45)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              style={{
                display: 'inline-block', background: 'var(--accent)', color: 'white',
                padding: '16px 36px', borderRadius: 9999, fontSize: 16, fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 0 24px var(--accent-glow)',
                fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
              }}
            >
              Book a Free Demo →
            </motion.a>
            <a
              href="/prospecting-os/tools/free-audit"
              style={{ color: 'var(--text-tertiary)', fontSize: 14, textDecoration: 'none' }}
            >
              Or get 50 leads audited free →
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
