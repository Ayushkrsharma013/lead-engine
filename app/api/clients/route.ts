import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendClientCredentialsEmail } from '@/lib/notify'
import { generatePaymentRef } from '@/lib/xflow'
import type { PlanKey } from '@/lib/types'

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)]
  }
  return pw
}

function generateUsername(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30) || 'client'
}

export async function POST(req: NextRequest) {
  const h = req.headers
  const role = h.get('x-user-role')
  const adminUserId = h.get('x-user-id')

  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, company, industry, monthlyRetainer, plan, email } = body as {
    name?: string; company?: string; industry?: string;
    monthlyRetainer?: number; plan?: PlanKey; email?: string;
  }

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }

  const clientPlan = plan || 'pilot'
  const tempPassword = generateTempPassword()
  const username = generateUsername(company || name)

  // 1. Create Supabase auth user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      role: 'client',
      plan: clientPlan,
    },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const userId = newUser.user.id
  const paymentRef = generatePaymentRef(userId, clientPlan)

  // 2. Create profile
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email: email.trim(),
    display_name: name,
    full_name: name,
    role: 'client',
    plan: clientPlan,
    subscription_status: 'pending_payment',
    payment_ref: paymentRef,
    is_active: true,
    created_by: adminUserId || null,
    onboarding_complete: false,
  })

  // 3. Create client record
  const { data: clientData, error: clientError } = await supabaseAdmin
    .from('clients')
    .insert({
      name,
      company: company || '',
      industry: industry || '',
      monthly_retainer: monthlyRetainer || 0,
      status: 'active',
      email: email.trim(),
      portal_username: username,
      portal_password: tempPassword,
      plan: clientPlan,
      user_id: userId,
    })
    .select()
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 400 })
  }

  // 4. Create client workspace
  await supabaseAdmin.from('client_workspaces').insert({
    client_user_id: userId,
    plan: clientPlan,
  })

  // 5. Send welcome email
  const clientPortalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com'}/prospecting-os/client-portal/login`

  await sendClientCredentialsEmail({
    to: email.trim(),
    clientName: name,
    clientId: clientData.id,
    username: email.trim(),
    tempPassword,
    loginUrl: clientPortalUrl,
  })

  return NextResponse.json({
    success: true,
    client: {
      id: clientData.id,
      userId,
      name,
      company,
      industry,
      email: email.trim(),
      portalUsername: username,
      plan: clientPlan,
      monthlyRetainer: monthlyRetainer || 0,
      status: 'active',
    },
    credentials: {
      clientId: clientData.id,
      username: email.trim(),
      tempPassword,
    },
  })
}

export async function GET(req: NextRequest) {
  const h = req.headers
  const role = h.get('x-user-role')

  if (role !== 'super_admin' && role !== 'qa_agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all clients
  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // For each client, fetch lead stats via user_id
  const enriched = await Promise.all((clients || []).map(async (c) => {
    let leadCount = 0
    let hotCount = 0
    let contactedCount = 0
    let meetingCount = 0
    let activeSequences = 0
    let totalPipelineValue = 0

    if (c.user_id) {
      const { count: lc } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', c.user_id)

      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, score, status')
        .eq('user_id', c.user_id)

      leadCount = lc || 0
      hotCount = (leads || []).filter(l => l.score >= 80).length
      contactedCount = (leads || []).filter(l => l.status === 'contacted' || l.status === 'replied').length
      meetingCount = (leads || []).filter(l => l.status === 'meeting').length
      totalPipelineValue = (leads || []).reduce((sum, l) => sum + (l.score || 0), 0)

      // Active sequences for this client's leads
      const leadIds = (leads || []).map(l => l.id)
      if (leadIds.length > 0) {
        const { count: seqCount } = await supabaseAdmin
          .from('sequence_executions')
          .select('*', { count: 'exact', head: true })
          .in('lead_id', leadIds)
          .eq('status', 'active')
        activeSequences = seqCount || 0
      }
    }

    return {
      id: c.id,
      userId: c.user_id,
      name: c.name,
      company: c.company,
      industry: c.industry,
      email: c.email,
      plan: c.plan || 'diy',
      status: c.status,
      monthlyRetainer: c.monthly_retainer || 0,
      portalUsername: c.portal_username,
      createdAt: c.created_at,
      stats: {
        totalLeads: leadCount,
        hotLeads: hotCount,
        contacted: contactedCount,
        meetings: meetingCount,
        activeSequences,
        totalPipelineValue,
      },
    }
  }))

  return NextResponse.json({ clients: enriched })
}
