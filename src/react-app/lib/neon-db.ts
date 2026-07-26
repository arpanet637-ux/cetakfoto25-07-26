/**
 * Neon Database Module
 * Replaces localStorage with Neon PostgreSQL backend
 * All API calls go to /api endpoints deployed on Vercel
 */

const API_BASE = process.env.VITE_API_URL || '/api';

// Helper to make API calls
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.status === 204 ? null : response.json();
};

// Orders
export const getOrders = async () => {
  return apiFetch('orders', { method: 'GET' });
};

export const createOrder = async (order: any) => {
  return apiFetch('orders', { method: 'POST', body: JSON.stringify(order) });
};

export const updateOrder = async (id: number, updates: any) => {
  return apiFetch('orders', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
};

export const deleteOrder = async (id: number) => {
  return apiFetch('orders', { method: 'DELETE', body: JSON.stringify({ id }) });
};

// Products
export const getProducts = async () => {
  return apiFetch('products', { method: 'GET' });
};

export const createProduct = async (product: any) => {
  return apiFetch('products', { method: 'POST', body: JSON.stringify(product) });
};

export const updateProduct = async (id: number, updates: any) => {
  return apiFetch('products', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
};

export const deleteProduct = async (id: number) => {
  return apiFetch('products', { method: 'DELETE', body: JSON.stringify({ id }) });
};

// Branches
export const getBranches = async () => {
  return apiFetch('branches', { method: 'GET' });
};

export const createBranch = async (branch: any) => {
  return apiFetch('branches', { method: 'POST', body: JSON.stringify(branch) });
};

export const updateBranch = async (id: number, updates: any) => {
  return apiFetch('branches', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
};

export const deleteBranch = async (id: number) => {
  return apiFetch('branches', { method: 'DELETE', body: JSON.stringify({ id }) });
};

// Settings
export const getSettings = async () => {
  return apiFetch('settings', { method: 'GET' });
};

export const updateSettings = async (settings: any) => {
  return apiFetch('settings', { method: 'PUT', body: JSON.stringify(settings) });
};

export default {
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getSettings,
  updateSettings,
};
