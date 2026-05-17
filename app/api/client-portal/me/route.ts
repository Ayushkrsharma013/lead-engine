import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAN_MODULES } from '@/lib/types'
import type { PlanKey } from '@/lib/types'

export async function GET(req: NextRequest) {
  // Use SSR client to get the authenticated user from cookies
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

  if (!profile) {
    // No profile — return basic info from auth user
    return NextResponse.json({
      profile: {
        id: userId,
        email: user.email || '',
        display_name: user.user_metadata?.display_name || '',
        role: user.user_metadata?.role || 'client',
        plan: user.user_metadata?.plan || 'diy',
        onboarding_complete: false,
        subscription_status: 'inactive',
        is_active: true,
      },
      workspace: null,
      allowedModules: PLAN_MODULES.diy || [],
    })
  }

  // Update last_login_at
  await supabaseAdmin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId)

  const { data: workspace } = await supabaseAdmin
    .from('client_workspaces')
    .select('*')
    .eq('client_user_id', userId)
    .maybeSingle()

  const allowedModules = (profile.role === 'qa_agent' || profile.role === 'super_admin')
    ? Object.values(PLAN_MODULES).flat()
    : PLAN_MODULES[(profile.plan as PlanKey) || 'diy'] ?? []

  return NextResponse.json({ profile, workspace, allowedModules })
}
