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

  const clientPlan = plan || 'diy'
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
