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
      // Get all orders with items
      const result = await db.query(`
        SELECT o.*, 
          json_agg(json_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'discount', oi.discount,
            'subtotal', oi.subtotal,
            'method', oi.method,
            'deadline_date', oi.deadline_date,
            'status', oi.status
          )) FILTER (WHERE oi.id IS NOT NULL) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);
      
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      // Create new order
      const { order_number, branch_id, client_name, client_phone, notes, total_amount, discount, items } = req.body;
      
      const orderResult = await db.query(
        `INSERT INTO orders (order_number, branch_id, client_name, client_phone, notes, total_amount, discount, paid_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [order_number, branch_id, client_name, client_phone, notes, total_amount, discount, 0]
      );

      const orderId = orderResult.rows[0].id;

      // Insert order items
      if (items && items.length > 0) {
        for (const item of items) {
          await db.query(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, method, deadline_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount, item.subtotal, item.method, item.deadline_date]
          );
        }
      }

      // Fetch the complete order with items
      const completeOrder = await db.query(`
        SELECT o.*, 
          json_agg(json_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'discount', oi.discount,
            'subtotal', oi.subtotal,
            'method', oi.method,
            'deadline_date', oi.deadline_date,
            'status', oi.status
          )) FILTER (WHERE oi.id IS NOT NULL) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1
        GROUP BY o.id`,
        [orderId]
      );

      res.status(201).json(completeOrder.rows[0]);
    } else if (req.method === 'PUT') {
      // Update order
      const { id, client_name, client_phone, notes, discount, status } = req.body;
      
      const result = await db.query(
        `UPDATE orders 
         SET client_name = COALESCE($2, client_name),
             client_phone = COALESCE($3, client_phone),
             notes = COALESCE($4, notes),
             discount = COALESCE($5, discount),
             status = COALESCE($6, status),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, client_name, client_phone, notes, discount, status]
      );

      res.status(200).json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      // Delete order
      const { id } = req.body;
      
      await db.query('DELETE FROM orders WHERE id = $1', [id]);
      res.status(204).end();
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
