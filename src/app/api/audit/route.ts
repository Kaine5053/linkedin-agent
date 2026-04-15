// ============================================================
// GET /api/audit
// Returns paginated audit log with optional filters.
// ?format=csv returns a downloadable CSV file.
//
// Query params:
//   lead_id       — filter by lead
//   event_type    — comma-separated list
//   from          — ISO date
//   to            — ISO date
//   limit         — default 100, max 500
//   offset        — pagination
//   format=csv    — returns CSV instead of JSON
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, requireAuth } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  let user: { id: string }
  try { user = await requireAuth(req.headers.get('Authorization')) }
  catch { return NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const p     = new URL(req.url).searchParams
  const limit  = Math.min(Number(p.get('limit') ?? 100), 500)
  const offset = Number(p.get('offset') ?? 0)
  const format = p.get('format') // 'csv' | null

  const supabase = createServerClient()

  let query = supabase
    .from('audit_log')
    .select(`
      id, event_type, payload, worker_ip, occurred_at,
      leads (full_name, linkedin_url, company, job_title)
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })

  // Filters
  if (p.get('lead_id'))     query = query.eq('lead_id', p.get('lead_id')!)
  if (p.get('event_type')) {
    const types = p.get('event_type')!.split(',').map(s => s.trim())
    query = query.in('event_type', types)
  }
  if (p.get('from')) query = query.gte('occurred_at', p.get('from')!)
  if (p.get('to'))   query = query.lte('occurred_at', p.get('to')!)

  if (format !== 'csv') {
    query = query.range(offset, offset + limit - 1)
  } else {
    // For CSV export, fetch up to 5000 rows
    query = query.limit(5000)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[audit] Query error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }

  // ── CSV Export ────────────────────────────────────────
  if (format === 'csv') {
    const rows = data ?? []
    const headers = ['Date/Time', 'Event Type', 'Lead Name', 'Company', 'Details', 'Worker IP']

    const csvLines = [
      headers.join(','),
      ...rows.map((r: any) => {
        const lead    = r.leads
        const payload = JSON.stringify(r.payload ?? {}).replace(/"/g, '""')
        const dt      = new Date(r.occurred_at).toLocaleString('en-GB')
        return [
          `"${dt}"`,
          `"${r.event_type}"`,
          `"${lead?.full_name ?? ''}"`,
          `"${lead?.company ?? ''}"`,
          `"${payload}"`,
          `"${r.worker_ip ?? ''}"`,
        ].join(',')
      }),
    ]

    const csv = csvLines.join('\n')
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // ── JSON Response ─────────────────────────────────────
  return NextResponse.json({
    rows:   data ?? [],
    total:  count ?? 0,
    limit,
    offset,
  })
}
