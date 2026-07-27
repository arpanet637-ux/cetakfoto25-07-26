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
      const { business_name, owner_name, phone, email, address, city, province, postal_code, admin_fee_bca, admin_fee_bri, admin_fee_mandiri, admin_fee_qris } = req.body;
      
      // Check if settings exist
      const existing = await query('SELECT id FROM store_settings LIMIT 1');
      
      let result;
      if (existing.rows.length > 0) {
        result = await query(
          `UPDATE store_settings 
           SET business_name = COALESCE($2, business_name),
               owner_name = COALESCE($3, owner_name),
               phone = COALESCE($4, phone),
               email = COALESCE($5, email),
               address = COALESCE($6, address),
               city = COALESCE($7, city),
               province = COALESCE($8, province),
               postal_code = COALESCE($9, postal_code),
               admin_fee_bca = COALESCE($10, admin_fee_bca),
               admin_fee_bri = COALESCE($11, admin_fee_bri),
               admin_fee_mandiri = COALESCE($12, admin_fee_mandiri),
               admin_fee_qris = COALESCE($13, admin_fee_qris),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id, business_name, owner_name, phone, email, address, city, province, postal_code, admin_fee_bca, admin_fee_bri, admin_fee_mandiri, admin_fee_qris]
        );
      } else {
        result = await query(
          `INSERT INTO store_settings (business_name, owner_name, phone, email, address, city, province, postal_code, admin_fee_bca, admin_fee_bri, admin_fee_mandiri, admin_fee_qris)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [business_name, owner_name, phone, email, address, city, province, postal_code, admin_fee_bca, admin_fee_bri, admin_fee_mandiri, admin_fee_qris]
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
