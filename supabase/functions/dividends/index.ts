import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

function withCors(resp: Response) {
  for (const [k, v] of Object.entries(corsHeaders)) {
    resp.headers.set(k, v);
  }
  return resp;
}


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/dividends')[1] || '/';
    const pathParts = path.split('/').filter(Boolean);

    // Helper: require admin/treasurer (server-side using service role)
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!jwt) {
      return json({ error: 'Missing/invalid Authorization Bearer token', tokenPresent: false }, 401);
    }


    // Validate token from custom auth function (it base64-encodes JSON)
    let tokenData: any;
    try {
      tokenData = JSON.parse(atob(jwt));
    } catch {
      return json({ error: 'Invalid or malformed token' }, 401);
    }

    if (!tokenData) {
      return json({ error: 'Token decoded to empty/invalid JSON' }, 401);
    }

    if (!tokenData.exp) {
      return json({ error: 'Token missing exp', tokenKeys: Object.keys(tokenData) }, 401);
    }

    if (tokenData.exp < Date.now()) {
      return json({ error: 'Token expired', exp: tokenData.exp }, 401);
    }

    if (tokenData.type !== 'admin') {
      // This dividends module is privileged (admin/treasurer only)
      return json({ error: 'Forbidden', tokenType: tokenData.type }, 403);
    }

    if (!tokenData.user_id) {
      return json({ error: 'Forbidden', tokenUserIdMissing: true }, 403);
    }


    // Determine role from users table
    let roleName: string | null = null;
    const { data: roleRow } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', tokenData.user_id)
      .maybeSingle();

    const roleId = roleRow?.role_id;
    if (roleId) {
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .maybeSingle();
      roleName = role?.name ?? null;
    }

    const requirePrivileged = () => {
      if (roleName !== 'admin' && roleName !== 'treasurer') {
        throw new Error('Forbidden');
      }
    };

    // GET /periods
    if (path === '/periods' && req.method === 'GET') {
      const { data } = await supabase.from('dividend_periods_view').select('*');
      return json(data || []);
    }

    // GET /allocations?period_id=...
    if (path === '/allocations' && req.method === 'GET') {
      const periodId = url.searchParams.get('period_id');
      if (!periodId) return json({ error: 'period_id is required' }, 400);
      const { data } = await supabase
        .from('dividend_allocations_view')
        .select('*')
        .eq('dividend_period_id', periodId)
        .order('member_full_name', { ascending: true });
      return json(data || []);
    }

    // POST /periods/:periodId/compute-estimated
    if (pathParts.length === 2 && pathParts[0] === 'periods' && pathParts[1] && req.method === 'POST') {
      return json({ error: 'Not found' }, 404);
    }

    if (pathParts.length === 3 && pathParts[0] === 'periods' && req.method === 'POST') {
      const periodId = pathParts[1];
      const action = pathParts[2];

      if (action === 'compute-estimated') {
        requirePrivileged();

        const { data: periodRow } = await supabase
          .from('dividend_periods')
          .select('id, status')
          .eq('id', periodId)
          .maybeSingle();
        if (!periodRow) return json({ error: 'Period not found' }, 404);

        const { data: gatingRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'audit_3rd_year_approved')
          .maybeSingle();

        const approved = Boolean((gatingRow?.value as any)?.approved);
        if (!approved) {
          return json({ error: 'Profit sharing is locked until 3rd-year audit is approved.' }, 403);
        }


        // Snapshot totals (share capital ONLY)
        const { data: sharesAgg } = await supabase
          .from('members')
          .select('share_capital_amount')
          .eq('status', 'active');

        const totalShareCapital = (sharesAgg ?? []).reduce((sum: number, r: any) => sum + Number(r.share_capital_amount || 0), 0);

        // Cooperative earnings heuristic (existing system): reuse earnings calc from loans (fully paid)
        const { data: earningsRow } = await supabase
          .from('loans')
          .select('principal_amount')
          .eq('status', 'fully_paid');

        const earnings = (earningsRow ?? []).reduce((sum: number, r: any) => sum + Number(r.principal_amount || 0) * 0.20, 0);


        // Update period totals
        await supabase.from('dividend_periods').update({
          total_share_capital: totalShareCapital,
          total_cooperative_earnings: earnings,
          status: 'estimated_approved',
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', periodId);

        // Replace allocations (read-only after final lock will be handled by UI + RLS improvements)
        await supabase.from('dividend_allocations').delete().eq('dividend_period_id', periodId);

        const { data: members } = await supabase
          .from('members')
          .select('id, employee_id, full_name, share_capital_amount')
          .eq('status', 'active');

        const allocRows = (members ?? []).map((m: any) => {
          const share = Number(m.share_capital_amount || 0);
          const ownership = totalShareCapital > 0 ? share / totalShareCapital : 0;
          return {
            dividend_period_id: periodId,
            member_id: m.id,
            member_share_capital: share,
            ownership_percent: ownership,
            profit_share_estimated: earnings * ownership,
          };
        });

        if (allocRows.length) {
          await supabase.from('dividend_allocations').insert(allocRows);
        }

        return json({ ok: true });
      }

      if (action === 'submit-audit') {
        requirePrivileged();
        await supabase
          .from('dividend_periods')
          .update({ status: 'audit_pending', updated_at: new Date().toISOString() })
          .eq('id', periodId);
        return json({ ok: true });
      }

      if (action === 'lock-final') {
        requirePrivileged();

        // Prevent locking unless the 3rd-year audit gate is approved
        const { data: gatingRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'audit_3rd_year_approved')
          .maybeSingle();

        const approved = Boolean((gatingRow?.value as any)?.approved);
        if (!approved) {
          return json({ error: 'Profit sharing is locked until 3rd-year audit is approved.' }, 403);
        }

        // Final audited profit share is currently not available as a distinct audited profit source
        // in this repo, so we lock the computed estimate as the final figures.
        const { data: allocs } = await supabase
          .from('dividend_allocations')
          .select('id, profit_share_estimated')
          .eq('dividend_period_id', periodId);

        for (const a of allocs ?? []) {
          await supabase
            .from('dividend_allocations')
            .update({ profit_share_final: a.profit_share_estimated })
            .eq('id', a.id);
        }

        await supabase
          .from('dividend_periods')
          .update({
            status: 'final_locked',
            locked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', periodId);

        return json({ ok: true });
      }


      return json({ error: 'Not found' }, 404);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Forbidden') return json({ error: message }, 403);
    console.error('Dividends error:', err);
    return json({ error: message }, 500);
  }
});

