import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAN_MODULES } from '@/lib/plan-modules'
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
    ? ((profile.plan as PlanKey) || 'pilot')
    : ((user.user_metadata?.plan as PlanKey) || 'pilot')

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

  if (!workspace) {
    return NextResponse.json({
      profile: profileData, workspace: null, allowedModules: [], plan,
      core: { total: 0, hot: 0, contacted: 0, avgScore: 0, meetings: 0 },
      recentLeads: [], industryBreakdown: [], statusBreakdown: [],
      icebreakers: [], slackConfigured: false,
      weeklyFlow: [], activeSequences: 0, conversionFunnel: [],
    })
  }

  const allowedModules = (profileData.role === 'qa_agent' || profileData.role === 'super_admin')
    ? Object.values(PLAN_MODULES).flat()
    : PLAN_MODULES[plan] ?? []

  // ── Core stats (all plans) — workspace-scoped client_leads ─────

  const { data: allLeads, count: totalLeads } = await supabaseAdmin
    .from('client_leads')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspace?.id)
    .order('score', { ascending: false })

  const leads = allLeads || []
  // client_leads doesn't have status column — derive from score
  const hot = leads.filter(l => (l.score || 0) >= 8.0).length
  const contacted = hot // hot = high-scoring leads
  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((s, l) => s + (Number(l.score) || 0), 0) / leads.length * 10) / 10
    : 0
  const meetings = 0 // No meeting tracking on client_leads yet

  const core = { total: totalLeads || 0, hot, contacted, avgScore, meetings }

  // ── Recent leads (all plans) ───────────────────────────────────

  const recentLeads = leads.slice(0, 10).map(l => ({
    id: l.id,
    name: l.name,
    title: l.title,
    company: l.company,
    industry: l.icp_match_reason || '',
    score: Number(l.score) || 0,
    status: (l.score || 0) >= 8.0 ? 'hot' : 'new',
  }))

  // ── Growth+ data ───────────────────────────────────────────────

  let industryBreakdown: { industry: string; count: number }[] = []
  let statusBreakdown: { status: string; count: number }[] = []
  let icebreakers: { leadName: string; company: string; body: string }[] = []
  let slackConfigured = false

  const showGrowth = allowedModules.includes('icebreakers') || (profileData.role === 'qa_agent' || profileData.role === 'super_admin')

  if (showGrowth) {
    // Industry breakdown — use icp_match_reason as proxy
    const industryMap: Record<string, number> = {}
    for (const l of leads) {
      const ind = (l as any).icp_match_reason?.split(';')[0]?.trim() || 'General'
      industryMap[ind] = (industryMap[ind] || 0) + 1
    }
    industryBreakdown = Object.entries(industryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([industry, count]) => ({ industry, count }))

    // Status breakdown — derived from score
    const statusMap: Record<string, number> = {}
    for (const l of leads) {
      const s = (l.score || 0) >= 8.0 ? 'hot' : 'new'
      statusMap[s] = (statusMap[s] || 0) + 1
    }
    const order = ['new', 'hot']
    statusBreakdown = order
      .filter(o => statusMap[o])
      .map(status => ({ status, count: statusMap[status] }))

    // Icebreakers — from client_icebreakers table
    const leadIds = leads.map(l => l.id)
    if (leadIds.length > 0) {
      const { data: ibr } = await supabaseAdmin
        .from('client_icebreakers')
        .select('lead_id, text')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false })
        .limit(3)

      if (ibr && ibr.length > 0) {
        icebreakers = ibr.map((m: any) => {
          const lead = leads.find(l => l.id === m.lead_id)
          return {
            leadName: lead?.name || 'Unknown',
            company: lead?.company || '',
            body: m.text?.slice(0, 200) || '',
          }
        })
      }
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
      if ((l as any).created_at) {
        const savedDate = new Date((l as any).created_at).toLocaleDateString('en-US', { weekday: 'short' })
        const slot = days.find(d => d.day === savedDate)
        if (slot) slot.count++
      }
    }
    weeklyFlow = days

    // Active sequences — not applicable for client_leads yet, skip
    activeSequences = 0

    // Conversion funnel — simplified for client_leads
    const funnelMap: Record<string, number> = {}
    for (const l of leads) {
      const s = (l.score || 0) >= 8.0 ? 'hot' : 'new'
      funnelMap[s] = (funnelMap[s] || 0) + 1
    }
    conversionFunnel = ['new', 'hot'].map(stage => ({
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
