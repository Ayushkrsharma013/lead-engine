import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAN_MODULES } from '@/lib/types'
import type { PlanKey } from '@/lib/types'

export async function GET(req: NextRequest) {
  const h = req.headers
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Update last_login_at
  await supabaseAdmin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId)

  const { data: workspace } = await supabaseAdmin
    .from('client_workspaces')
    .select('*')
    .eq('client_user_id', userId)
    .maybeSingle()

  const allowedModules = profile.role === 'qa_agent'
    ? Object.values(PLAN_MODULES).flat()
    : PLAN_MODULES[(profile.plan as PlanKey) || 'diy'] ?? []

  return NextResponse.json({ profile, workspace, allowedModules })
}
