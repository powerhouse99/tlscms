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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/payments')[1] || '/';
  const userId = getUserId(req);

  try {
    // Record payment
    if (path === '/' && req.method === 'POST') {
      const body = await req.json();
      const { loan_id, amount, payment_date, payment_method, notes } = body;

      // Get loan
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('*, installment_amount')
        .eq('id', loan_id)
        .single();

      if (loanError || !loan) {
        return new Response(
          JSON.stringify({ error: 'Loan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate payment amount - only exact installment allowed
      const expectedAmount = loan.installment_amount;
      if (Math.abs(amount - expectedAmount) > 0.01) {
        return new Response(
          JSON.stringify({
            error: `Invalid payment amount. Expected: ₱${expectedAmount.toFixed(2)}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get first pending or missed schedule
      const { data: schedules } = await supabase
        .from('loan_schedules')
        .select('*')
        .eq('loan_id', loan_id)
        .in('status', ['pending', 'missed'])
        .order('installment_number', { ascending: true })
        .limit(1);

      const schedule = schedules?.[0];

      if (!schedule) {
        return new Response(
          JSON.stringify({ error: 'No pending payment found for this loan' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate receipt number
      const { data: receiptResult } = await supabase.rpc('generate_receipt_number', { prefix: 'RCP' });

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('loan_payments')
        .insert({
          loan_id,
          schedule_id: schedule.id,
          payment_date,
          amount,
          receipt_number: receiptResult,
          payment_method: payment_method || 'cash',
          received_by: userId,
          notes
        })
        .select()
        .single();

      if (paymentError) {
        return new Response(
          JSON.stringify({ error: paymentError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update schedule
      await supabase
        .from('loan_schedules')
        .update({
          status: 'paid',
          actual_payment_date: payment_date,
          amount_paid: amount,
          is_missed: false
        })
        .eq('id', schedule.id);

      // Get updated schedule stats
      const { data: allSchedules } = await supabase
        .from('loan_schedules')
        .select('*')
        .eq('loan_id', loan_id);

      const paidCount = allSchedules?.filter(s => s.status === 'paid').length || 0;
      const missedCount = allSchedules?.filter(s => s.is_missed).length || 0;
      const newBalance = loan.remaining_balance - amount;

      // Get next due schedule
      const { data: nextSchedule } = await supabase
        .from('loan_schedules')
        .select('*')
        .eq('loan_id', loan_id)
        .in('status', ['pending', 'missed'])
        .order('installment_number', { ascending: true })
        .limit(1)
        .single();

      // Update loan
      const newStatus = newBalance <= 0 ? 'fully_paid' : (missedCount > 0 ? 'delayed' : 'active');

      await supabase
        .from('loans')
        .update({
          payments_made: paidCount,
          remaining_balance: Math.max(0, newBalance),
          missed_payment_count: missedCount,
          next_due_date: nextSchedule?.due_date || null,
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', loan_id);

      // Update member summary
      await supabase.rpc('update_member_summary', { target_member_id: loan.member_id });

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'INSERT',
        table_name: 'loan_payments',
        record_id: payment.id,
        new_values: { ...payment, loan_status: newStatus }
      });

      return new Response(
        JSON.stringify(payment),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payments for loan
    if (path.startsWith('/loan/') && req.method === 'GET') {
      const loanId = path.split('/loan/')[1];

      const { data, error } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

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
    console.error('Payments error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
