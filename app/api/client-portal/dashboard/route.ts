import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAN_MODULES } from '@/lib/types'
import type { PlanKey } from '@/lib/types'

export async function GET(req: NextRequest) {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
  const ssrClient = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  const plan: PlanKey = profile
    ? ((profile.plan as PlanKey) || 'diy')
    : ((user.user_metadata?.plan as PlanKey) || 'diy')

  const profileData = profile || {
    id: userId,
    email: user.email || '',
    display_name: user.user_metadata?.display_name || '',
    role: user.user_metadata?.role || 'client',
    plan,
    onboarding_complete: false,
    subscription_status: 'inactive',
    is_active: true,
  }

  const { data: workspace } = await supabaseAdmin
    .from('client_workspaces')
    .select('*')
    .eq('client_user_id', userId)
    .maybeSingle()
  const allowedModules = ((profileData.role === 'qa_agent' || profileData.role === 'super_admin') || profileData.role === 'super_admin')
    ? Object.values(PLAN_MODULES).flat()
    : PLAN_MODULES[plan] ?? []

  // ── Core stats (all plans) ─────────────────────────────────────

  const { data: allLeads, count: totalLeads } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('score', { ascending: false })

  const leads = allLeads || []
  const hot = leads.filter(l => l.score >= 80).length
  const contacted = leads.filter(l => l.status && l.status !== 'new').length
  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length)
    : 0
  const meetings = leads.filter(l => l.status === 'meeting').length

  const core = { total: totalLeads || 0, hot, contacted, avgScore, meetings }

  // ── Recent leads (all plans) ───────────────────────────────────

  const recentLeads = leads.slice(0, 10).map(l => ({
    id: l.id,
    name: l.name,
    title: l.title,
    company: l.company,
    industry: l.industry,
    score: l.score,
    status: l.status || 'new',
  }))

  // ── Growth+ data ───────────────────────────────────────────────

  let industryBreakdown: { industry: string; count: number }[] = []
  let statusBreakdown: { status: string; count: number }[] = []
  let icebreakers: { leadName: string; company: string; body: string }[] = []
  let slackConfigured = false

  const showGrowth = allowedModules.includes('icebreakers') || (profileData.role === 'qa_agent' || profileData.role === 'super_admin')

  if (showGrowth) {
    // Industry breakdown
    const industryMap: Record<string, number> = {}
    for (const l of leads) {
      const ind = l.industry || 'Unknown'
      industryMap[ind] = (industryMap[ind] || 0) + 1
    }
    industryBreakdown = Object.entries(industryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([industry, count]) => ({ industry, count }))

    // Status breakdown
    const statusMap: Record<string, number> = {}
    for (const l of leads) {
      const s = l.status || 'new'
      statusMap[s] = (statusMap[s] || 0) + 1
    }
    const order = ['new', 'contacted', 'replied', 'hot', 'meeting', 'won', 'lost']
    statusBreakdown = order
      .filter(o => statusMap[o])
      .map(status => ({ status, count: statusMap[status] }))

    // Icebreakers — latest 3 messages for this user's leads
    const { data: msgs } = await supabaseAdmin
      .from('messages')
      .select('lead_id, body')
      .order('created_at', { ascending: false })
      .limit(50)

    if (msgs && msgs.length > 0) {
      const userLeadIds = new Set(leads.map(l => l.id))
      const userMsgs = msgs.filter(m => userLeadIds.has(m.lead_id))
      icebreakers = userMsgs.slice(0, 3).map(m => {
        const lead = leads.find(l => l.id === m.lead_id)
        return {
          leadName: lead?.name || 'Unknown',
          company: lead?.company || '',
          body: m.body?.slice(0, 200) || '',
        }
      })
    }

    // Slack configured
    slackConfigured = !!(workspace?.slack_webhook)
  }

  // ── Scale data ─────────────────────────────────────────────────

  let weeklyFlow: { day: string; count: number }[] = []
  let activeSequences = 0
  let conversionFunnel: { stage: string; count: number }[] = []

  const showScale = allowedModules.includes('sequences') || (profileData.role === 'qa_agent' || profileData.role === 'super_admin')

  if (showScale) {
    // Weekly lead flow — last 7 days
    const days: { day: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: 0 })
    }
    for (const l of leads) {
      if (l.saved_at) {
        const savedDate = new Date(l.saved_at).toLocaleDateString('en-US', { weekday: 'short' })
        const slot = days.find(d => d.day === savedDate)
        if (slot) slot.count++
      }
    }
    weeklyFlow = days

    // Active sequences for this user's leads
    const leadIds = leads.map(l => l.id)
    if (leadIds.length > 0) {
      const { count: seqCount } = await supabaseAdmin
        .from('sequence_executions')
        .select('*', { count: 'exact', head: true })
        .in('lead_id', leadIds)
        .eq('status', 'active')
      activeSequences = seqCount || 0
    }

    // Conversion funnel
    const funnelOrder = ['new', 'contacted', 'replied', 'hot', 'meeting', 'won', 'lost']
    const funnelMap: Record<string, number> = {}
    for (const l of leads) {
      const s = l.status || 'new'
      funnelMap[s] = (funnelMap[s] || 0) + 1
    }
    conversionFunnel = funnelOrder.map(stage => ({
      stage,
      count: funnelMap[stage] || 0,
    }))
  }

  return NextResponse.json({
    profile: profileData,
    workspace,
    allowedModules,
    plan,
    core,
    recentLeads,
    industryBreakdown,
    statusBreakdown,
    icebreakers,
    slackConfigured,
    weeklyFlow,
    activeSequences,
    conversionFunnel,
  })
}
