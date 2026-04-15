// ============================================================
// Pacing Engine (Vercel side)
// Calculates when a new action should be scheduled.
// The VPS worker enforces these times — it will not execute
// an action before execute_after, regardless of when it polls.
//
// Rules enforced:
//   - Max 15 connection requests / day per user
//   - Max 20 comments / day per user
//   - Actions only between working_hours_start and working_hours_end
//   - No weekend actions (when weekend_pause = true)
//   - Minimum 25-minute gap between any two actions
//   - Gaussian jitter on every delay (mean=0, σ=15min)
// ============================================================

import { createServerClient } from '../supabase/client'
import type { UserSettings, ActionType } from '../../types'

// Box-Muller transform — generates a normally distributed random number
// mean=0, standard deviation=1
function gaussianRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Add Gaussian jitter to a delay.
 * @param baseMs       — base delay in milliseconds
 * @param stdDevMs     — standard deviation in milliseconds (default 15 min)
 * @param minMs        — floor — never returns less than this
 */
function addJitter(
  baseMs: number,
  stdDevMs: number = 15 * 60 * 1000,
  minMs: number = 5 * 60 * 1000
): number {
  const jitter = gaussianRandom() * stdDevMs
  return Math.max(minMs, baseMs + jitter)
}

/**
 * Advance a Date to the next valid working moment.
 * "Valid" = weekday (if weekend_pause), within working hours.
 */
function nextWorkingMoment(date: Date, settings: UserSettings, timezone: string): Date {
  const result = new Date(date)

  // Helper: get local hour in user's timezone
  const getLocalHour = (d: Date) => {
    return parseInt(
      d.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }),
      10
    )
  }

  // Helper: get local day of week (0=Sun, 6=Sat) in user's timezone
  const getLocalDay = (d: Date) => {
    return parseInt(
      d.toLocaleString('en-GB', { weekday: 'short', timeZone: timezone })
        === 'Sat' ? '6' : d.toLocaleString('en-GB', { weekday: 'short', timeZone: timezone })
        === 'Sun' ? '0' : String(new Date(d.toLocaleString('en-US', { timeZone: timezone })).getDay()),
      10
    )
  }

  // Max 7 iterations to avoid infinite loops
  for (let i = 0; i < 7 * 24; i++) {
    const localHour = getLocalHour(result)
    const localDay  = getLocalDay(result)

    const isWeekend  = settings.weekend_pause && (localDay === 0 || localDay === 6)
    const tooEarly   = localHour < settings.working_hours_start
    const tooLate    = localHour >= settings.working_hours_end

    if (!isWeekend && !tooEarly && !tooLate) {
      return result  // this moment is valid
    }

    if (isWeekend || tooLate) {
      // Jump to next day's working_hours_start
      result.setDate(result.getDate() + 1)
      result.setHours(settings.working_hours_start, 0, 0, 0)
    } else if (tooEarly) {
      // Jump to today's working_hours_start
      result.setHours(settings.working_hours_start, 0, 0, 0)
    }
  }

  // Fallback — should never reach here
  return result
}

/**
 * Count how many actions of a given type have been executed today
 * for a user (in their local timezone).
 */
async function countTodayActions(
  userId: string,
  actionType: ActionType,
  timezone: string
): Promise<number> {
  const supabase = createServerClient()

  // Get start of today in user's timezone
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }) // 'YYYY-MM-DD'
  const todayStart = new Date(`${todayStr}T00:00:00`)
  const todayStartUtc = new Date(
    todayStart.toLocaleString('en-US', { timeZone: 'UTC' })
  ).toISOString()

  const { count, error } = await supabase
    .from('pending_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .in('status', ['completed', 'in_progress', 'scheduled', 'pending'])
    .gte('created_at', todayStartUtc)

  if (error) {
    console.error('[pacing] Failed to count today actions:', error.message)
    return 0
  }

  return count ?? 0
}

/**
 * Get the timestamp of the last action for this user (any type).
 * Used to enforce the minimum gap between actions.
 */
async function getLastActionTime(userId: string): Promise<Date | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('pending_actions')
    .select('execute_after')
    .eq('user_id', userId)
    .in('status', ['pending', 'scheduled', 'completed', 'in_progress'])
    .order('execute_after', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return new Date(data.execute_after)
}

export interface PacingResult {
  allowed: boolean
  reason?: string         // why it was blocked
  execute_after: Date     // when to schedule (only valid if allowed=true)
}

/**
 * Main pacing calculation.
 * Call this before creating any pending_action.
 *
 * Returns { allowed: false, reason } if daily cap is hit.
 * Returns { allowed: true, execute_after } with the correct
 * scheduled timestamp (respecting all pacing rules) if OK.
 */
export async function calculateExecuteAfter(params: {
  userId: string
  actionType: ActionType
  settings: UserSettings
  timezone: string
}): Promise<PacingResult> {
  const { userId, actionType, settings, timezone } = params

  // 1. Check daily caps
  const dailyCap =
    actionType === 'connection_request'
      ? settings.daily_connection_limit   // default 15
      : actionType === 'post_comment'
        ? settings.daily_comment_limit    // default 20
        : 999 // no cap on profile views / DMs (DMs are manually approved)

  const todayCount = await countTodayActions(userId, actionType, timezone)

  if (todayCount >= dailyCap) {
    return {
      allowed: false,
      reason: `Daily ${actionType} cap of ${dailyCap} reached (used: ${todayCount})`,
      execute_after: new Date(),
    }
  }

  // 2. Base: now + minimum gap
  const minGapMs = settings.min_gap_minutes * 60 * 1000  // default 25 min
  let candidate = new Date(Date.now() + minGapMs)

  // 3. Enforce minimum gap from last scheduled action
  const lastAction = await getLastActionTime(userId)
  if (lastAction) {
    const gapFromLast = lastAction.getTime() + minGapMs
    if (gapFromLast > candidate.getTime()) {
      candidate = new Date(gapFromLast)
    }
  }

  // 4. Add Gaussian jitter (σ = 15 min)
  const jitteredMs = addJitter(candidate.getTime() - Date.now())
  candidate = new Date(Date.now() + jitteredMs)

  // 5. Advance to next valid working moment if outside hours / weekend
  const scheduled = nextWorkingMoment(candidate, settings, timezone)

  return {
    allowed: true,
    execute_after: scheduled,
  }
}
