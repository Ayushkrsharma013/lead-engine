import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { jobActivateProfile } from '@/lib/finance-agent'
import { PLANS } from '@/lib/stripe'
import type { PlanKey } from '@/lib/types'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const planKey = (body.plan_key as PlanKey) || undefined

  // If plan_key provided, update the plan first
  if (planKey) {
    await supabaseAdmin.from('profiles').update({
      plan: planKey,
      payment_ref: body.transaction_id || null,
    }).eq('id', params.id)
  }

  // Activate the profile (reuses finance-agent logic)
  const result = await jobActivateProfile(params.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Activation failed' }, { status: 400 })
  }

  // Audit log — record which admin triggered the activation
  const adminUserId = h.get('x-user-id')
  await supabaseAdmin.from('activity_log').insert({
    user_id: adminUserId,
    type: 'agent_action',
    text: `Manually activated plan for ${result.email} (user ${params.id})`,
  })

  return NextResponse.json({ success: true, email: result.email })
}
