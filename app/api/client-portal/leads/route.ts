import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const h = req.headers
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const scoreMin = searchParams.get('score_min') ? parseInt(searchParams.get('score_min')!) : null
  const sort = searchParams.get('sort') ?? 'score'

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order(sort === 'score' ? 'score' : 'saved_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (scoreMin !== null) query = query.gte('score', scoreMin)

  const { data: leads, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads, count, page, limit })
}
