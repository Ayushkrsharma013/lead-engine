import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { data: recentCalls } = await supabaseAdmin
    .from('tool_rate_limits')
    .select('id')
    .eq('tool', 'icebreaker')
    .eq('ip', ip)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if ((recentCalls?.length ?? 0) >= 3) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  }

  const body = await req.json()
  const { prospectName, prospectTitle, company, industry, recentActivity, yourOffer, tone } = body

  if (!prospectName || !prospectTitle || !company) {
    return NextResponse.json({ error: 'Name, title, and company are required.' }, { status: 400 })
  }

  // Insert rate-limit record BEFORE calling Claude so a failed insert
  // doesn't give the user infinite free generations.
  await supabaseAdmin.from('tool_rate_limits').insert({
    tool: 'icebreaker',
    ip,
    created_at: new Date().toISOString(),
  });

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 })
  }

  const toneGuide = tone === 'professional'
    ? 'Professional and polished — respectful, formal, concise'
    : tone === 'direct'
    ? 'Punchy and direct — gets to the point in 1-2 sentences, no fluff'
    : 'Warm and human — like reaching out to someone you almost know'

  const prompt = `You are an expert B2B cold outreach specialist. Write a single personalized icebreaker opening line for a cold email or LinkedIn message.

PROSPECT:
- Name: ${prospectName}
- Title: ${prospectTitle}
- Company: ${company}
- Industry: ${industry || 'Not specified'}

RECENT ACTIVITY / CONTEXT:
${recentActivity || 'No specific activity provided — use their title and company context'}

WHAT WE OFFER:
${yourOffer || 'AI-powered B2B lead generation automation'}

TONE: ${toneGuide}

RULES:
- Write ONLY the icebreaker opening line — no subject line, no full email, no greeting like "Hi [name]"
- Start with a specific observation about them or their company — not a generic compliment
- Reference the context naturally — don't sound like you're reading a profile
- Maximum 2 sentences, under 50 words
- Do NOT use phrases like "I came across your profile", "I noticed", "I hope this message finds you well"
- Do NOT mention our product directly — the icebreaker is just the hook
- Output ONLY the icebreaker text — no quotes, no explanation, no preamble

Write the icebreaker:`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    console.error('Claude API error:', await claudeRes.text())
    return NextResponse.json({ error: 'AI generation failed. Try again.' }, { status: 500 })
  }

  const claudeData = await claudeRes.json() as {
    content?: Array<{ type: string; text: string }>
  }
  const icebreaker = claudeData.content?.[0]?.text?.trim()

  if (!icebreaker) {
    return NextResponse.json({ error: 'No output from AI. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ icebreaker })
}
