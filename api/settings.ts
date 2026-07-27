import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './db';

export default async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM store_settings ORDER BY id DESC LIMIT 1');
      res.status(200).json(result.rows[0] || {});
    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { name, phone, email, address, instagram, facebook, user_id, admin_fee_qris, admin_fee_va, admin_fee_ewallet, admin_fee_cc } = req.body;
      
      // Check if settings exist
      const existing = await query('SELECT id FROM store_settings LIMIT 1');
      
      let result;
      if (existing.rows.length > 0) {
        result = await query(
          `UPDATE store_settings 
           SET name = COALESCE($2, name),
               phone = COALESCE($3, phone),
               email = COALESCE($4, email),
               address = COALESCE($5, address),
               instagram = COALESCE($6, instagram),
               facebook = COALESCE($7, facebook),
               user_id = COALESCE($8, user_id),
               admin_fee_qris = COALESCE($9, admin_fee_qris),
               admin_fee_va = COALESCE($10, admin_fee_va),
               admin_fee_ewallet = COALESCE($11, admin_fee_ewallet),
               admin_fee_cc = COALESCE($12, admin_fee_cc),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id, name, phone, email, address, instagram, facebook, user_id, admin_fee_qris, admin_fee_va, admin_fee_ewallet, admin_fee_cc]
        );
      } else {
        result = await query(
          `INSERT INTO store_settings (name, phone, email, address, instagram, facebook, user_id, admin_fee_qris, admin_fee_va, admin_fee_ewallet, admin_fee_cc)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [name, phone, email, address, instagram, facebook, user_id, admin_fee_qris, admin_fee_va, admin_fee_ewallet, admin_fee_cc]
        );
      }

      if (result.rows.length === 0) {
        return res.status(500).json({ error: 'Failed to save settings' });
      }

      res.status(200).json(result.rows[0]);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
