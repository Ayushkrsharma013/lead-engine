import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin' && role !== 'qa_agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: workspace } = await supabaseAdmin
    .from('client_workspaces')
    .select('*')
    .eq('client_user_id', params.id)
    .maybeSingle()

  const { data: activity } = await supabaseAdmin
    .from('activity_log')
    .select('*')
    .eq('user_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: qaSessions } = await supabaseAdmin
    .from('qa_sessions')
    .select('*')
    .eq('triggered_by', params.id)
    .order('started_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ profile, workspace, activity, qaSessions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  const allowedFields = ['display_name', 'role', 'plan', 'notes', 'is_active', 'subscription_status', 'modules_allowed']
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates['updated_at'] = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync workspace if plan changed
  if (body.plan) {
    const { data: existing } = await supabaseAdmin
      .from('client_workspaces')
      .select('id')
      .eq('client_user_id', params.id)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin.from('client_workspaces').update({ plan: body.plan, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('client_workspaces').insert({ client_user_id: params.id, plan: body.plan })
    }
  }

  return NextResponse.json({ profile: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  // Soft delete: deactivate, don't delete auth user
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      is_active: false,
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data, deactivated: true })
}
