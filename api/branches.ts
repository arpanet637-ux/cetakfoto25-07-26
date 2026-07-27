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
      const result = await query('SELECT * FROM branches ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { name, address, phone, user_id } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Branch name is required' });
      }
      
      const result = await query(
        `INSERT INTO branches (name, address, phone, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, address, phone, user_id]
      );

      res.status(201).json(result.rows[0]);
    } else if (req.method === 'PUT') {
      const { id, name, address, phone, user_id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Branch ID is required' });
      }
      
      const result = await query(
        `UPDATE branches 
         SET name = COALESCE($2, name),
             address = COALESCE($3, address),
             phone = COALESCE($4, phone),
             user_id = COALESCE($5, user_id),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, name, address, phone, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      res.status(200).json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Branch ID is required' });
      }
      
      const result = await query('DELETE FROM branches WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Branch not found' });
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
