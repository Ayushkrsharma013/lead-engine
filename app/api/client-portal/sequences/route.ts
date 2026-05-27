import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const h = req.headers
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'active'

  const { data, error } = await supabaseAdmin
    .from('sequence_executions')
    .select('id, sequence_id, lead_id, current_step, status, variant, started_at, sequences!inner(id, name, steps)')
    .eq('user_id', userId)
    .eq('status', status)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const executions = (data || []).map((r: Record<string, unknown>) => {
    const seqRaw = r.sequences
    const seq = (Array.isArray(seqRaw) ? seqRaw[0] : seqRaw) as Record<string, unknown> | null
    const steps = (seq?.steps as unknown[]) || []
    return {
      id: String(r.id),
      sequence_id: String(r.sequence_id),
      lead_id: String(r.lead_id),
      current_step: Number(r.current_step),
      status: String(r.status),
      variant: String(r.variant || ''),
      started_at: String(r.started_at),
      sequence_name: String(seq?.name || 'Unknown'),
      steps_count: steps.length,
    }
  })

  return NextResponse.json({ executions })
}
