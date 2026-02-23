// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  // Execute via CRON using Service Role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  try {
    // We only nullify reservation pieces, we don't immediately restock inventory_pieces
    // since they were never deducted for a draft. Drafts ONLY reserve.
    // Wait, let's verify Layer 1 logic: Drafts do NOT touch inventory_pieces or reserved_pieces.
    // Confirms DO touch inventory_pieces.
    // Therefore for expired drafts, we just DELETE them, cascades handle items.
    
    // Find drafts older than 24 hours
    const { data: expiredDrafts, error: fetchError } = await supabaseAdmin
      .from('blast_orders')
      .select('id')
      .eq('status', 'draft')
      .lte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      
    if (fetchError) throw fetchError;

    if (!expiredDrafts || expiredDrafts.length === 0) {
        return new Response(JSON.stringify({ message: "No expired drafts found" }), { status: 200 })
    }
    
    // Delete drafts
    const ids = expiredDrafts.map((d: any) => d.id)
    const { error: deleteError } = await supabaseAdmin
        .from('blast_orders')
        .delete()
        .in('id', ids)

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ message: `Purged ${ids.length} expired drafts` }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
