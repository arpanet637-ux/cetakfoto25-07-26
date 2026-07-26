import { VercelRequest, VercelResponse } from '@vercel/node';
import db from './db';

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
      const result = await db.query('SELECT * FROM branches ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { name, address, phone } = req.body;
      
      const result = await db.query(
        `INSERT INTO branches (name, address, phone)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, address, phone]
      );

      res.status(201).json(result.rows[0]);
    } else if (req.method === 'PUT') {
      const { id, name, address, phone } = req.body;
      
      const result = await db.query(
        `UPDATE branches 
         SET name = COALESCE($2, name),
             address = COALESCE($3, address),
             phone = COALESCE($4, phone),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, name, address, phone]
      );

      res.status(200).json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      const { id } = req.body;
      
      await db.query('DELETE FROM branches WHERE id = $1', [id]);
      res.status(204).end();
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
