'use client'
import { motion } from 'framer-motion'

const FEATURES = [
  { label: 'Pricing', pros: '$1,499+$499 / $2,499+$999/mo', sdr: '$4,000–6,000/mo salary', apollo: '$99–$149/mo', clay: '$149–$800/mo', uplead: '$99–$299/mo' },
  { label: 'Lead volume', pros: '500+ / month', sdr: '40–60 / month', apollo: 'Unlimited export (no scoring)', clay: 'Unlimited (manual workflows)', uplead: '200–1,000 / month' },
  { label: 'AI ICP scoring', pros: '✓ Claude AI — 1–10 with reasoning', sdr: '✗ Manual judgment', apollo: '✗ No scoring', clay: '⚠ DIY via Clay AI', uplead: '✗ No scoring' },
  { label: 'Personalized icebreaker', pros: '✓ Unique per lead, context-aware', sdr: '⚠ Human-written, slow', apollo: '✗ No', clay: '⚠ Template-based', uplead: '✗ No' },
  { label: 'Company enrichment', pros: '✓ News, funding, LinkedIn, tech stack', sdr: '⚠ Inconsistent', apollo: '⚠ Basic firmographics', clay: '✓ Via integrations', uplead: '⚠ Basic firmographics' },
  { label: 'Daily Slack/Telegram delivery', pros: '✓ Hot leads every morning by 8 AM', sdr: '✗ Manual reporting', apollo: '✗ No', clay: '✗ No', uplead: '✗ No' },
  { label: 'No-hire required', pros: '✓ Zero headcount', sdr: '✗ Full hire + ramp + benefits', apollo: '✓', clay: '✓ But high setup time', uplead: '✓' },
  { label: 'Setup time', pros: '4 hours (Pilot) / 2–3 days (Growth)', sdr: '30–90 days (hire + ramp)', apollo: 'Immediate', clay: '1–4 weeks (complex)', uplead: 'Immediate' },
  { label: 'Data privacy', pros: '✓ Your dashboard — we never store', sdr: 'N/A', apollo: '⚠ Apollo stores all data', clay: '⚠ Clay stores all data', uplead: '⚠ Uplead stores all data' },
  { label: 'Performance guarantee', pros: '✓ 50 leads or month 2 free', sdr: '✗ No guarantee', apollo: '✗ No', clay: '✗ No', uplead: '✗ No' },
]

const COLUMNS = [
  { key: 'pros', label: 'Prospecting OS', highlight: true },
  { key: 'sdr', label: 'In-house SDR' },
  { key: 'apollo', label: 'Apollo.io' },
  { key: 'clay', label: 'Clay' },
  { key: 'uplead', label: 'Uplead' },
]

export function ComparisonTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflowX: 'auto', paddingTop: 16 }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)', width: 180 }}>Feature</th>
            {COLUMNS.map(col => (
              <th key={col.key} style={{
                padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600,
                borderBottom: col.highlight ? '2px solid rgba(232,66,10,0.5)' : '1px solid var(--border)',
                background: col.highlight ? 'rgba(232,66,10,0.06)' : 'transparent',
                color: col.highlight ? 'var(--accent)' : 'var(--text-secondary)',
                borderRadius: col.highlight ? '8px 8px 0 0' : 0,
                position: 'relative',
              }}>
                {col.highlight && (
                  <span style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 600,
                    padding: '2px 10px', borderRadius: 9999, fontFamily: 'monospace',
                    letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>Best value</span>
                )}
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((row, i) => (
            <motion.tr
              key={row.label}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: 'easeOut' }}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {row.label}
              </td>
              {COLUMNS.map(col => {
                const val = row[col.key as keyof typeof row] as string
                const isCheck = val.startsWith('✓')
                const isCross = val.startsWith('✗')
                const isWarn = val.startsWith('⚠')
                return (
                  <td key={col.key} style={{
                    padding: '14px 16px', textAlign: 'center', fontSize: 12,
                    background: col.highlight ? 'rgba(232,66,10,0.04)' : 'transparent',
                    color: isCheck ? (col.highlight ? 'var(--accent)' : 'var(--success)')
                      : isCross ? 'var(--text-tertiary)'
                      : isWarn ? '#d4a040'
                      : 'var(--text-secondary)',
                    fontWeight: col.highlight ? 600 : 400,
                    lineHeight: 1.5,
                  }}>
                    {val}
                  </td>
                )
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <motion.a
          href="/book"
          whileHover={{ scale: 1.02, boxShadow: '0 0 32px rgba(232,66,10,0.4)' }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            display: 'inline-block', background: 'var(--accent)', color: 'white',
            padding: '16px 36px', borderRadius: 9999, fontSize: 15, fontWeight: 600,
            textDecoration: 'none', boxShadow: '0 0 24px var(--accent-glow)',
          }}
        >
          Book a Demo — Start Outperforming Apollo in Week 1 →
        </motion.a>
      </div>
    </motion.div>
  )
}
