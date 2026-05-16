import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const h = req.headers
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return leads with high scores that would have icebreakers (messages linked)
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .gte('score', 60)
    .order('score', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch associated messages (icebreakers) for these leads
  const leadIds = (leads || []).map((l: { id: string }) => l.id)
  let messages: Array<Record<string, unknown>> = []
  if (leadIds.length > 0) {
    const { data: msgs } = await supabaseAdmin
      .from('messages')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
    messages = msgs || []
  }

  // Group messages by leadId
  const msgsByLead: Record<string, Array<Record<string, unknown>>> = {}
  for (const m of messages) {
    const lid = String(m.lead_id || '')
    if (!msgsByLead[lid]) msgsByLead[lid] = []
    msgsByLead[lid].push(m)
  }

  const enriched = (leads || []).map((lead: Record<string, unknown>) => ({
    ...lead,
    icebreakers: msgsByLead[String(lead.id || '')] || [],
  }))

  return NextResponse.json({ leads: enriched })
}
