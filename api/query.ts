import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    if (req.method !== 'POST') {
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { table, select = '*', eq, in: inQuery, limit, order, single } = req.body;
    
    if (!table) {
      return res.status(400).json({ error: 'Table parameter is required' });
    }

    let query: any = supabase.from(table).select(select);

    if (eq) {
      Object.keys(eq).forEach(key => {
        query = query.eq(key, eq[key]);
      });
    }

    if (inQuery) {
      Object.keys(inQuery).forEach(key => {
        query = query.in(key, inQuery[key]);
      });
    }

    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    if (limit) {
      query = query.limit(limit);
    }
    
    if (single) {
      query = query.single();
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('API Query Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
