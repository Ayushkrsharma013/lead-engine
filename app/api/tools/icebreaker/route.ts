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

  // Insert rate-limit record BEFORE calling Gemini so a failed insert
  // doesn't give the user infinite free generations.
  await supabaseAdmin.from('tool_rate_limits').insert({
    tool: 'icebreaker',
    ip,
    created_at: new Date().toISOString(),
  });

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
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

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 200,
          topP: 0.9,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!geminiRes.ok) {
    console.error('Gemini API error:', await geminiRes.text())
    return NextResponse.json({ error: 'AI generation failed. Try again.' }, { status: 500 })
  }

  const geminiData = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> } }>
  }
  const parts = geminiData.candidates?.[0]?.content?.parts ?? []
  const textPart = parts.find(p => !p.thought) ?? parts[0]
  const icebreaker = textPart?.text?.trim()

  if (!icebreaker) {
    return NextResponse.json({ error: 'No output from AI. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ icebreaker })
}
