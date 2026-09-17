// The Divine Gamba's settlement.
//
// A play is paid for by `begin_divine_gamba_play`, which freezes the machine
// and draws the seed. This function runs the same simulation the browser
// animates, from that seed on that machine, and hands the outcome to
// `settle_divine_gamba_play`, which only the service role may call. The
// browser never tells the server what happened; it asks the server to find
// out.
//
// Deno, not Vite: the simulation is copied into ../_shared by
// scripts/sync-divine-gamba-sim.mjs, and this file imports nothing from src/.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { simulatePlay, SIM_VERSION } from '../_shared/divine-gamba-sim/index.ts'
import type { DivineGambaMachineConfig } from '../_shared/divine-gamba-sim/index.ts'

interface PendingPlay {
  id: number
  profile_id: string
  status: 'pending' | 'settled'
  seed: number
  sim_version: number
  ball_count: number
  stake_price: number
  machine: DivineGambaMachineConfig
  result: unknown
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (request.method !== 'POST') {
    return reply(405, { error: 'POST a play to settle.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return reply(500, { error: 'The settlement is not configured.' })
  }

  // Who is asking. The anon client carries the caller's token, so a token
  // that is missing, expired or forged never reaches the play.
  const authorization = request.headers.get('Authorization') ?? ''
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) {
    return reply(401, { error: 'Sign in to settle a play.' })
  }

  let playId: number
  try {
    const body = await request.json() as { playId?: unknown }
    playId = Number(body.playId)
  } catch {
    return reply(400, { error: 'A play ID is required.' })
  }
  if (!Number.isSafeInteger(playId) || playId < 1) {
    return reply(400, { error: 'A play ID is required.' })
  }

  // What is owed. The service client reads past row-level security, so the
  // owner check is explicit.
  const asHouse = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: play, error: playError } = await asHouse
    .from('divine_gamba_plays')
    .select('id, profile_id, status, seed, sim_version, ball_count, stake_price, machine, result')
    .eq('id', playId)
    .eq('profile_id', userData.user.id)
    .maybeSingle<PendingPlay>()
  if (playError) {
    return reply(500, { error: playError.message })
  }
  if (!play) {
    return reply(404, { error: 'No such play.' })
  }
  if (play.status === 'settled') {
    return reply(200, { ...(play.result as Record<string, unknown>), was_processed: false })
  }
  if (play.sim_version !== SIM_VERSION) {
    return reply(409, {
      error: `This play was begun under simulation ${play.sim_version}; this settlement runs ${SIM_VERSION}.`,
    })
  }

  const outcome = simulatePlay({
    seed: play.seed,
    machine: play.machine,
    ballCount: play.ball_count,
    stakePrice: play.stake_price,
  })

  const { data: settled, error: settleError } = await asHouse.rpc('settle_divine_gamba_play', {
    p_play_id: play.id,
    p_outcome: outcome,
  })
  if (settleError) {
    return reply(500, { error: settleError.message })
  }
  return reply(200, settled)
})
