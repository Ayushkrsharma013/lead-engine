import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { PLANS } from '@/lib/stripe'
import { generatePaymentRef } from '@/lib/xflow'
import type { PlanKey } from '@/lib/types'

export async function GET(req: NextRequest) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin' && role !== 'qa_agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filterRole = searchParams.get('role')
  const status = searchParams.get('status')
  const search = searchParams.get('q')

  let query = supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (filterRole) query = query.eq('role', filterRole)
  if (status) query = query.eq('subscription_status', status)
  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data })
}

export async function POST(req: NextRequest) {
  const h = req.headers
  const role = h.get('x-user-role')
  const adminUserId = h.get('x-user-id')
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  const { email, display_name, role: newRole, plan, notes, send_invite } = await req.json()

  if (!email || !newRole) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }

  // Create Supabase auth user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name, role: newRole },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const userId = newUser.user.id
  const paymentRef = plan ? generatePaymentRef(userId, plan as PlanKey) : null

  // Upsert profile
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    display_name,
    full_name: display_name || '',
    role: newRole,
    plan: plan || null,
    subscription_status: plan ? 'pending_payment' : null,
    payment_ref: paymentRef,
    is_active: true,
    created_by: adminUserId,
    notes: notes || null,
    onboarding_complete: newRole === 'client' ? false : true,
  })

  // Create client workspace if client role
  if (newRole === 'client' && plan) {
    await supabaseAdmin.from('client_workspaces').insert({
      client_user_id: userId,
      plan,
    })
  }

  // Send invite email
  if (send_invite) {
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/prospecting-os/${newRole === 'client' ? 'client-portal' : 'dashboard'}`,
      },
    })

    const loginUrl = (linkData as { properties?: { action_link?: string } })?.properties?.action_link
      ?? `${process.env.NEXT_PUBLIC_SITE_URL}/prospecting-os/login`
    const planObj = plan ? PLANS[plan as keyof typeof PLANS] : null

    await sendEmail({
      to: email,
      subject: `You've been invited to Prospecting OS`,
      html: buildInviteEmail(display_name || email, loginUrl, planObj?.name, paymentRef),
    })
  }

  return NextResponse.json({ success: true, userId, paymentRef })
}

function buildInviteEmail(name: string, loginUrl: string, planName?: string, paymentRef?: string | null): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0e0d0a;color:#f5f4f1;padding:40px;border-radius:12px;">
      <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">Welcome to Prospecting OS</h1>
      <p style="color:#b0aeaa;margin:0 0 24px;">Hi ${name}, your account has been created.</p>
      ${planName ? `<p style="color:#b0aeaa;">Plan: <strong style="color:#f5f4f1;">${planName}</strong></p>` : ''}
      ${paymentRef ? `<p style="color:#b0aeaa;">Payment ref: <code style="background:#1a1917;padding:2px 8px;border-radius:4px;">${paymentRef}</code></p>` : ''}
      <a href="${loginUrl}" style="display:inline-block;background:#E8A840;color:#000;padding:12px 28px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px;">
        Access Your Dashboard →
      </a>
      <p style="color:#7a7875;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p>
    </div>
  `
}
