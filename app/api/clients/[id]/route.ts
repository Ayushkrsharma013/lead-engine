import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')

  if (role !== 'super_admin' && role !== 'qa_agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) updates.status = body.status
  if (body.name !== undefined) updates.name = body.name
  if (body.company !== undefined) updates.company = body.company
  if (body.industry !== undefined) updates.industry = body.industry
  if (body.monthlyRetainer !== undefined) updates.monthly_retainer = body.monthlyRetainer
  if (body.plan !== undefined) updates.plan = body.plan
  if (body.email !== undefined) updates.email = body.email

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ client: data })
}
