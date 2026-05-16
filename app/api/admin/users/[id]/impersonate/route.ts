import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const h = req.headers
  const role = h.get('x-user-role')
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, role')
    .eq('id', params.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const dest = profile.role === 'client' ? 'client-portal' : 'dashboard'

  const { data } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/prospecting-os/${dest}`,
    },
  })

  const url = (data as { properties?: { action_link?: string } })?.properties?.action_link

  // Log impersonation for audit trail
  const adminUserId = h.get('x-user-id')
  await supabaseAdmin.from('activity_log').insert({
    user_id: adminUserId,
    type: 'agent_action',
    text: `Impersonated user ${profile.email} (${params.id})`,
  })

  return NextResponse.json({ url })
}
