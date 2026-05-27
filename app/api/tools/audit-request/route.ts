import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { notifyTelegram } from '@/lib/notify'

async function isCapReached(): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('audit_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  return (count ?? 0) >= 5
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const company = formData.get('company') as string
  const website = formData.get('website') as string
  const teamSize = formData.get('teamSize') as string
  const weeklyHours = formData.get('weeklyHours') as string
  const currentTool = formData.get('currentTool') as string
  const icpDescription = formData.get('icpDescription') as string
  const csvFile = formData.get('csv') as File | null

  if (!name?.trim() || !email?.trim() || !company?.trim()) {
    return NextResponse.json({ error: 'Name, email, and company are required.' }, { status: 400 })
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  const capped = await isCapReached()
  if (capped) {
    return NextResponse.json({
      error: "We've reached our weekly audit cap of 5. Please check back next week or book a call instead.",
    }, { status: 429 })
  }

  const { data: existing } = await supabaseAdmin
    .from('audit_requests')
    .select('id')
    .eq('email', email)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      error: 'We already have an audit request from this email in the last 30 days.',
    }, { status: 400 })
  }

  let csvFilename: string | null = null
  let csvBase64: string | null = null

  if (csvFile && csvFile.size > 0) {
    if (csvFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'CSV file must be under 5MB.' }, { status: 400 })
    }
    csvFilename = csvFile.name
    const buffer = await csvFile.arrayBuffer()
    csvBase64 = Buffer.from(buffer).toString('base64')
  }

  const requestId = crypto.randomUUID()

  const { error: insertError } = await supabaseAdmin
    .from('audit_requests')
    .insert({
      id: requestId,
      name, email, company, website,
      team_size: teamSize,
      weekly_hours: weeklyHours,
      current_tool: currentTool,
      icp_description: icpDescription,
      csv_filename: csvFilename,
      csv_data: csvBase64,
      status: 'pending',
    })

  if (insertError) {
    console.error('audit_requests insert error:', insertError)
    return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
  }

  // Fire-and-forget: send confirmation email + Telegram notification
  const request = { id: requestId }
  sendEmail({
    to: email,
    subject: 'Free Pipeline Audit — Request Received',
    html: buildConfirmationEmail(name, company, request.id),
  }).catch(e => console.error('Audit confirmation email failed:', e))

  const telegramMsg = [
    `NEW FREE AUDIT REQUEST`,
    ``,
    `Name: ${name} @ ${company}`,
    `Email: ${email}`,
    `Website: ${website || 'Not provided'}`,
    `Team: ${teamSize || 'Not specified'}`,
    `Weekly hours: ${weeklyHours || 'Not specified'}`,
    `Current tool: ${currentTool || 'None'}`,
    `ICP: ${icpDescription ? icpDescription.slice(0, 120) + '...' : 'Not provided'}`,
    `CSV: ${csvFilename ?? 'Not uploaded'}`,
    `ID: ${request.id}`,
  ].join('\n')

  notifyTelegram(telegramMsg).catch(e => console.error('Audit Telegram notify failed:', e))

  return NextResponse.json({ success: true })
}

function buildConfirmationEmail(name: string, company: string, requestId: string): string {
  return `
    <div style="font-family:'Geist',sans-serif;max-width:600px;margin:0 auto;background:#0e0d0a;color:#f5f4f1;padding:40px;border-radius:12px;">
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#e8420a;font-family:monospace;margin:0 0 12px;">// Audit Request Confirmed</p>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">We've received your audit request, ${name}.</h1>

      <p style="color:#b0aeaa;line-height:1.7;margin:0 0 24px;">
        We're queuing your pipeline audit for <strong style="color:#f5f4f1;">${company}</strong>.
        Within <strong style="color:#f5f4f1;">24 hours</strong>, you'll receive a scored report with every contact scored, reasoned, and icebreaker-ready.
      </p>

      <div style="background:#1a1917;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="font-size:12px;color:#7a7875;margin:0 0 8px;font-family:monospace;">What's in your report:</p>
        <ul style="color:#b0aeaa;font-size:14px;margin:0;padding-left:20px;line-height:2;">
          <li>ICP score (1–10) with written reasoning for every contact</li>
          <li>Contacts below 7 filtered out — only hot leads delivered</li>
          <li>Company enrichment (news, funding, tech stack)</li>
          <li>Personalized icebreaker for each qualified lead</li>
        </ul>
      </div>

      <p style="color:#b0aeaa;font-size:14px;margin:0 0 24px;">
        Request ID: <code style="background:#1a1917;padding:2px 8px;border-radius:4px;font-size:12px;">${requestId}</code>
      </p>

      <p style="color:#7a7875;font-size:13px;margin:0 0 20px;">
        Want to skip the wait and see this running live for your full pipeline?
      </p>

      <a href="https://app.flow-forges.com/prospecting-os/book"
         style="display:inline-block;background:#e8420a;color:white;padding:13px 28px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">
        Book a Strategy Call →
      </a>

      <p style="color:#555;font-size:12px;margin-top:32px;">
        Prospecting OS by Flow-Forges · <a href="https://flow-forges.com" style="color:#555;">flow-forges.com</a>
      </p>
    </div>
  `
}
