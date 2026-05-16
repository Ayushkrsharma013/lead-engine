import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { email, industry } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Check duplicate in last 24hrs
  const { data: existing } = await supabaseAdmin
    .from('email_captures')
    .select('id, created_at')
    .eq('email', email)
    .eq('source', 'sample_report')
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ success: true, message: 'Already sent! Check your inbox (including spam).' })
  }

  await supabaseAdmin.from('email_captures').insert({ email, source: 'sample_report' })

  await sendEmail({
    to: email,
    subject: `Your sample lead report — ${industry ?? 'B2B'} ICP`,
    html: buildSampleReportEmail(email, industry),
  })

  return NextResponse.json({ success: true, message: 'Sample report sent! Check your inbox.' })
}

function buildSampleReportEmail(email: string, industry?: string): string {
  const sampleLeads = [
    { name: 'J. Morrison', title: 'VP of Marketing', company: 'GrowthStack Inc', score: 9.1, icebreaker: 'Saw your recent post on scaling PLG motion — we helped a similar-stage SaaS cut CAC by 40%...' },
    { name: 'S. Patel', title: 'Head of Growth', company: 'Meridian SaaS', score: 8.7, icebreaker: 'Your Series A announcement caught my eye — congrats. We\'ve built pipelines for post-A SaaS...' },
    { name: 'R. Chen', title: 'Founder & CEO', company: 'Dataform Labs', score: 8.2, icebreaker: 'Your LinkedIn post on founder-led sales resonated — we extend founder selling without headcount...' },
    { name: 'A. Williams', title: 'Director of Sales', company: 'CloudNine Solutions', score: 7.8, icebreaker: 'Noticed you\'re expanding into APAC based on recent job posts — our pipeline covers that region...' },
    { name: 'M. Rodriguez', title: 'CMO', company: 'Nexus Analytics', score: 7.5, icebreaker: 'Your piece on B2B content strategy was spot-on. We turn content audiences into direct pipeline...' },
  ]

  const leadsHtml = sampleLeads.map(lead => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #1a1917;color:#f5f4f1;font-weight:500;">${lead.name}</td>
      <td style="padding:12px;border-bottom:1px solid #1a1917;color:#b0aeaa;">${lead.title}</td>
      <td style="padding:12px;border-bottom:1px solid #1a1917;color:#b0aeaa;">${lead.company}</td>
      <td style="padding:12px;border-bottom:1px solid #1a1917;text-align:center;">
        <span style="background:rgba(232,66,10,0.15);color:#e8420a;border:1px solid rgba(232,66,10,0.3);padding:2px 10px;border-radius:9999px;font-family:monospace;font-size:12px;font-weight:600;">${lead.score}</span>
      </td>
      <td style="padding:12px;border-bottom:1px solid #1a1917;color:#7a7875;font-style:italic;font-size:12px;">"${lead.icebreaker}"</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:'Geist',sans-serif;max-width:680px;margin:0 auto;background:#0e0d0a;color:#f5f4f1;padding:40px;border-radius:12px;">
      <div style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:24px;margin-bottom:24px;">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#e8420a;font-family:monospace;margin:0 0 8px;">// Sample Report</p>
        <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">Your ${industry ?? 'B2B'} Lead Sample</h1>
        <p style="color:#b0aeaa;margin:0;">5 AI-scored leads from a live pipeline run. All scored 7.5+ out of 10.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <thead>
          <tr style="background:#1a1917;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7a7875;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Name</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7a7875;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Title</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7a7875;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Company</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#7a7875;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Score</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#7a7875;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Icebreaker</th>
          </tr>
        </thead>
        <tbody>${leadsHtml}</tbody>
      </table>
      <div style="background:#1a1917;border:1px solid rgba(232,66,10,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="font-weight:600;margin:0 0 8px;">This is what 500+ looks like, every month.</p>
        <p style="color:#b0aeaa;margin:0;font-size:14px;">Each lead above was found, scored against an ICP, enriched with company context, and given a unique icebreaker — automatically. No human research hours.</p>
      </div>
      <a href="https://app.flow-forges.com/prospecting-os/book" style="display:inline-block;background:#e8420a;color:white;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">
        Book a Free Demo →
      </a>
      <p style="color:#7a7875;font-size:12px;margin-top:24px;">
        You're receiving this because you requested a sample from Prospecting OS.
      </p>
    </div>
  `
}
