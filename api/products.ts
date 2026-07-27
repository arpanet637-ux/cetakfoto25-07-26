import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './db';

export default async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM products ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { name, price, stock, min_stock, default_method, user_id } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Product name is required' });
      }
      
      const result = await query(
        `INSERT INTO products (name, price, stock, min_stock, default_method, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, price || 0, stock || 0, min_stock || 0, default_method, user_id]
      );

      res.status(201).json(result.rows[0]);
    } else if (req.method === 'PUT') {
      const { id, name, price, stock, min_stock, default_method, user_id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }
      
      const result = await query(
        `UPDATE products 
         SET name = COALESCE($2, name),
             price = COALESCE($3, price),
             stock = COALESCE($4, stock),
             min_stock = COALESCE($5, min_stock),
             default_method = COALESCE($6, default_method),
             user_id = COALESCE($7, user_id),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, name, price, stock, min_stock, default_method, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }
      
      const result = await query('DELETE FROM products WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.status(204).end();
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
