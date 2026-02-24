import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const authHeader = req.headers.authorization;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} }
  });

  try {
    if (req.method === 'GET') {
      const [productsRes, ordersRes, orderItemsRes] = await Promise.all([
        supabase.from('blast_products').select('id, name, inventory_pieces, pieces_per_case'),
        supabase.from('blast_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('blast_order_items').select('product_id, cases_ordered, unit_price_piece_snapshot, pieces_per_case_snapshot, blast_products(name)')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (orderItemsRes.error) throw orderItemsRes.error;

      return res.status(200).json({
        products: productsRes.data,
        orders: ordersRes.data,
        items: orderItemsRes.data
      });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
