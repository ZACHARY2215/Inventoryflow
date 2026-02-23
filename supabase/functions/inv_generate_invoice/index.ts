// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { order_id, company_name } = await req.json()
    if (!order_id) throw new Error('Missing order_id')

    // 1. Fetch Order and Line Items
    const { data: order, error: orderError } = await supabaseClient
      .from('blast_orders')
      .select('*, blast_users(email)')
      .eq('id', order_id)
      .single()

    if (orderError) throw new Error(`Order fetch failed: ${orderError.message}`)
    if (order.status !== 'confirmed' && order.status !== 'delivered') {
      throw new Error('Only confirmed or delivered orders can generate an invoice')
    }
    
    // Authorization Check
    const { data: requestingUser } = await supabaseClient
      .from('blast_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (requestingUser?.role !== 'admin' && order.user_id !== user.id) {
       throw new Error('Unauthorized to access this invoice')
    }

    const { data: items, error: itemsError } = await supabaseClient
      .from('blast_order_items')
      .select('*, blast_products(sku, name)')
      .eq('order_id', order_id)

    if (itemsError) throw itemsError

    // 2. See if Invoice exists, if so, just return the exact signed URL
    const { data: existingInvoice } = await supabaseClient
      .from('blast_invoices')
      .select('pdf_url')
      .eq('order_id', order_id)
      .single()

    let finalPdfPath = existingInvoice ? existingInvoice.pdf_url : null;

    if (!finalPdfPath) {
      // 3. Generate PDF — SINGLE page with Customer Copy (top) + Company Copy (bottom)
      const pdfDoc = await PDFDocument.create()
      const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      const invoiceNumber = `INV-${new Date(order.created_at).getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
      const companyLabel = (company_name || 'INVENTORY FLOW').toUpperCase()
      const page = pdfDoc.addPage([595.28, 841.89]) // A4
      const { width, height } = page.getSize()
      const midY = height / 2 // ~420 pts

      const draw = (text, x, y, size = 9, font = regular, color = rgb(0.1, 0.1, 0.1)) => {
        page.drawText(text, { x, y, size, font, color })
      }

      // Pre-calculate total
      let calculatedTotal = 0
      for (const item of items) { calculatedTotal += parseFloat(item.total_price) }

      // ── Render one copy at a given Y offset ──
      const renderCopy = (baseY, copyLabel) => {
        // Company header
        draw(companyLabel, 40, baseY - 25, 14, bold, rgb(0.02, 0.588, 0.412))
        draw(copyLabel, 40, baseY - 38, 7, bold, rgb(0.5, 0.5, 0.5))

        // Invoice meta (right)
        draw(`Invoice: ${invoiceNumber}`, 360, baseY - 25, 9, bold)
        draw(`Order: ${order.order_number}`, 360, baseY - 37, 8)
        draw(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 360, baseY - 48, 8)

        // Bill To
        draw('Bill To:', 40, baseY - 55, 7, bold, rgb(0.5, 0.5, 0.5))
        draw(order.customer_name || 'Walk-in Customer', 40, baseY - 66, 9, bold)
        if (order.blast_users?.email) {
          draw(`By: ${order.blast_users.email}`, 40, baseY - 77, 7, regular, rgb(0.5, 0.5, 0.5))
        }

        // Separator line
        page.drawLine({ start: { x: 40, y: baseY - 85 }, end: { x: width - 40, y: baseY - 85 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })

        // Table header
        let ty = baseY - 100
        draw('Product', 40, ty, 8, bold)
        draw('Cs', 290, ty, 8, bold)
        draw('Pcs', 325, ty, 8, bold)
        draw('Price', 370, ty, 8, bold)
        draw('Total', 450, ty, 8, bold)
        ty -= 5
        page.drawLine({ start: { x: 40, y: ty }, end: { x: width - 40, y: ty }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) })
        ty -= 12

        // Table rows
        for (const item of items) {
          const pName = `${item.blast_products.sku} - ${item.blast_products.name}`
          const truncName = pName.length > 40 ? pName.substring(0, 37) + '...' : pName
          draw(truncName, 40, ty, 8)
          draw(`${item.cases_ordered}`, 290, ty, 8)
          draw(`${item.computed_pieces}`, 325, ty, 8)
          draw(`${parseFloat(item.unit_price_piece_snapshot).toFixed(2)}`, 370, ty, 8)
          draw(`${parseFloat(item.total_price).toFixed(2)}`, 450, ty, 8)
          ty -= 14
          if (ty < baseY - 370) break
        }

        // Total line
        ty -= 4
        page.drawLine({ start: { x: 330, y: ty }, end: { x: width - 40, y: ty }, thickness: 1, color: rgb(0.2, 0.2, 0.2) })
        ty -= 16
        draw('TOTAL:', 330, ty, 10, bold)
        draw(`Php ${calculatedTotal.toFixed(2)}`, 430, ty, 10, bold)

        // Payment method
        if (order.payment_method) {
          ty -= 14
          draw(`Payment: ${order.payment_method.toUpperCase()}`, 330, ty, 8, regular, rgb(0.4, 0.4, 0.4))
        }

        // Footer
        draw('Thank you for your business.', 40, baseY - 395, 7, regular, rgb(0.6, 0.6, 0.6))
      }

      // ── Customer Copy (top half) ──
      renderCopy(height, 'CUSTOMER COPY')

      // ── Dashed cut line in the middle ──
      const dashLen = 8, gapLen = 4
      let dx = 30
      while (dx < width - 30) {
        page.drawLine({
          start: { x: dx, y: midY },
          end: { x: Math.min(dx + dashLen, width - 30), y: midY },
          thickness: 0.8,
          color: rgb(0.6, 0.6, 0.6),
          dashArray: [dashLen, gapLen],
        })
        dx += dashLen + gapLen
      }
      // Scissors icon text
      draw('✂', 20, midY - 4, 10, regular, rgb(0.5, 0.5, 0.5))

      // ── Company Copy (bottom half) ──
      renderCopy(midY - 10, 'COMPANY COPY')

      const pdfBytes = await pdfDoc.save()
      
      // 4. Upload to Storage
      finalPdfPath = `invoices/${invoiceNumber}.pdf`
      const { error: uploadError } = await supabaseClient.storage
        .from('invoices')
        .upload(finalPdfPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        })
      
      if (uploadError) throw uploadError

      // 5. Save Record
      const { error: insertError } = await supabaseClient
        .from('blast_invoices')
        .insert({
           invoice_number: invoiceNumber,
           order_id: order.id,
           pdf_url: finalPdfPath
        })
      
      if (insertError) throw insertError
    }

    // 6. Generate Signed URL
    const { data: signedData, error: signedError } = await supabaseClient.storage
       .from('invoices')
       .createSignedUrl(finalPdfPath, 60 * 60) // 1 Hour

    if (signedError) throw signedError

    return new Response(
      JSON.stringify({ success: true, url: signedData.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
