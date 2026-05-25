import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const tokenData = JSON.parse(atob(token));
    return tokenData.user_id;
  } catch {
    return null;
  }
}

function getTokenData(req: Request): any | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/config')[1] || '/';
  const userId = getUserId(req);
  const tokenData = getTokenData(req);

  try {
    // Reset operational data while preserving tables, users, roles, and configuration.
    if (path === '/reset-data' && req.method === 'POST') {
      if (tokenData?.type !== 'admin' || tokenData?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Only admins can reset system data' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json().catch(() => ({}));
      if (body.confirmation !== 'RESET DATA') {
        return new Response(
          JSON.stringify({ error: 'Confirmation phrase is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resetTables = [
        'loan_payments',
        'loan_schedules',
        'dividend_allocations',
        'loans',
        'share_capitals',
        'cutoff_periods',
        'dividend_periods',
        'notifications',
        'backup_logs',
        'activity_logs',
        'audit_logs',
        'members',
      ];

      const results: Array<{ table: string; error?: string }> = [];

      for (const table of resetTables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          results.push({ table, error: error.message });
        } else {
          results.push({ table });
        }
      }

      const failed = results.filter((result) => result.error);
      if (failed.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Some data could not be reset', results }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all config
    if (path === '/' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get single config by key
    const keyMatch = path.match(/^\/key\/([^/]+)$/);
    if (keyMatch && req.method === 'GET') {
      const key = keyMatch[1];

      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .eq('config_key', key)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Config not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update config
    if (path === '/' && req.method === 'PUT') {
      const body = await req.json();
      const { config_key, config_value } = body;

      // Get old value
      const { data: oldConfig } = await supabase
        .from('system_config')
        .select('*')
        .eq('config_key', config_key)
        .single();

      // Update config
      const { data, error } = await supabase
        .from('system_config')
        .upsert({
          config_key,
          config_value,
          category: body.category || 'system',
          description: body.description || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE',
        table_name: 'system_config',
        record_id: data.id,
        old_values: oldConfig,
        new_values: data
      });

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get configs by category
    if (path.startsWith('/category/') && req.method === 'GET') {
      const category = path.split('/category/')[1];

      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .eq('category', category);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Config error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
