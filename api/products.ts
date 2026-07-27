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
      const { name, description, price, default_method, category } = req.body;
      
      const result = await query(
        `INSERT INTO products (name, description, price, default_method, category)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, description, price, default_method, category]
      );

      res.status(201).json(result.rows[0]);
    } else if (req.method === 'PUT') {
      const { id, name, description, price, default_method, category } = req.body;
      
      const result = await query(
        `UPDATE products 
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             price = COALESCE($4, price),
             default_method = COALESCE($5, default_method),
             category = COALESCE($6, category),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, name, description, price, default_method, category]
      );

      res.status(200).json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      const { id } = req.body;
      
      await query('DELETE FROM products WHERE id = $1', [id]);
      res.status(204).end();
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
