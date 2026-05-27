'use client'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { AuditForm } from '@/components/tools/AuditForm'
import Link from 'next/link'

const MotionLink = motion(Link);

export default function FreeAuditPage() {
  return (
    <div className="landing-page">
      <Navbar />

      {/* Hero */}
      <section style={{ padding: '120px 0 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 9999, padding: '6px 16px', fontSize: 13,
              color: '#22c55e', fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 24,
            }}>
              <motion.span
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}
              />
              Limited — 5 free audits per week
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.15,
              margin: '0 0 20px',
              fontFamily: 'Cabinet Grotesk, Geist, sans-serif',
            }}
          >
            We&apos;ll score 50 of your leads.{' '}
            <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 }}>
              For free.
            </em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 32px' }}
          >
            Upload a CSV of up to 50 LinkedIn contacts from your actual prospect list.
            Our AI scores each one against your ICP, writes a personalized icebreaker,
            and delivers a scored report — within 24 hours. Zero cost. No strings.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}
          >
            {['Results in 24 hours', 'No credit card', 'Your data stays private'].map((pill, i) => (
              <motion.span
                key={pill}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
                style={{
                  fontSize: 13, padding: '6px 14px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 9999, color: 'var(--text-secondary)',
                }}
              >
                ✓ {pill}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ color: 'var(--text-tertiary)', fontSize: 20 }}
          >
            ↓
          </motion.div>

        </div>
      </section>

      {/* What you get — 3 cards */}
      <section style={{ padding: '0 0 64px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', marginBottom: 32 }}>
            // What you get
          </p>
          <motion.div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              {
                icon: '01',
                title: 'AI ICP score for each contact',
                desc: 'Every lead scored 1–10 against your ICP with a written reason. "Score 8.5 — exact title match, SaaS, growth-stage, US-based, budget signals on LinkedIn."',
              },
              {
                icon: '02',
                title: 'Personalized icebreaker',
                desc: "Claude AI reads each lead's recent LinkedIn activity, company news, and funding history to write a unique cold outreach opening. Not a template — a real icebreaker.",
              },
              {
                icon: '03',
                title: 'Report delivery',
                desc: 'All scored leads delivered to your inbox within 24 hours. Name, title, company, score, reasoning, icebreaker. Copy and paste directly into your outreach.',
              },
            ].map((card) => (
              <motion.div
                key={card.icon}
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
                }}
                whileHover={{ y: -6, borderColor: 'rgba(232,66,10,0.3)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 16, padding: '28px 24px',
                }}
              >
                <span style={{
                  display: 'inline-block', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em',
                  marginBottom: 12, background: 'rgba(232,66,10,0.1)',
                  padding: '2px 10px', borderRadius: 9999,
                  border: '1px solid rgba(232,66,10,0.2)',
                }}>
                  {card.icon}
                </span>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: '0 0 10px', fontFamily: 'Cabinet Grotesk, Geist, sans-serif' }}>
                  {card.title}
                </p>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Audit form */}
      <section style={{ padding: '0 0 96px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '40px 36px',
            }}
          >
            <p style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', margin: '0 0 8px' }}>
              // Submit your audit request
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 32px' }}>
              Fill in your details and attach your prospect CSV. We&apos;ll run the AI pipeline and email you the scored report within 24 hours.
            </p>
            <AuditForm />
          </motion.div>
        </div>
      </section>

      {/* Sample output preview */}
      <section style={{ padding: '0 0 96px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--accent)', marginBottom: 12 }}>
            // Sample output
          </p>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
            Here&apos;s exactly what lands in your report within 24 hours.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--border)' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Title', 'Company', 'Score', 'Reason', 'Icebreaker (first 60 chars)'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'left', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: '█████ M.', title: 'VP Marketing', company: 'GrowthStack', score: 9.1, reason: 'Exact ICP — SaaS, growth-stage, US, budget signals', ice: '"Saw your post on scaling PLG — we helped a similar-stage SaaS cut...' },
                  { name: '█████ P.', title: 'Head of Growth', company: 'Meridian SaaS', score: 8.7, reason: 'Post-Series A, hiring sales team, right geography', ice: '"Congrats on the funding round — we built pipelines for 3 post-A..."' },
                  { name: '█████ C.', title: 'Founder & CEO', company: 'Dataform Labs', score: 8.2, reason: 'Founder-led sales, active on LinkedIn, exact vertical', ice: '"Your piece on founder-led sales resonated — we built an AI system..."' },
                  { name: '█████ W.', title: 'Director of Sales', company: 'CloudNine', score: 7.8, reason: 'APAC expansion signals, hiring SDRs — needs pipeline', ice: '"Noticed your APAC job posts — our pipeline covers that geo well..."' },
                  { name: '█████ R.', title: 'CMO', company: 'Nexus Analytics', score: 4.2, reason: 'Wrong industry fit — B2C focus, too large (2,000+ emp)', ice: '— (below threshold, not enriched)' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.title}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.company}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 9999,
                        background: row.score >= 7 ? 'rgba(232,66,10,0.15)' : 'rgba(255,255,255,0.05)',
                        color: row.score >= 7 ? 'var(--accent)' : 'var(--text-tertiary)',
                        border: `1px solid ${row.score >= 7 ? 'rgba(232,66,10,0.3)' : 'var(--border)'}`,
                      }}>
                        {row.score}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 200 }}>{row.reason}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: 220 }}>{row.ice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, marginTop: 16 }}>
            Names blurred for privacy. Real output includes full names, LinkedIn URLs, and complete icebreakers.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', fontFamily: 'Cabinet Grotesk, Geist, sans-serif' }}>
            Want 500 of these{' '}
            <em style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400 }}>every month?</em>
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
            The free audit runs on the same pipeline our Managed Growth clients get — 500+ scored leads, enriched and icebreaker-ready, delivered to Slack every morning.
          </p>
          <MotionLink
            href="/book"
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
            Book a Free Strategy Call →
          </MotionLink>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
