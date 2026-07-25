import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@getmocha/users-service/react";
import type { Product, CreateProduct, UpdateProduct } from "@/shared/types";

const API_BASE = "/api/products";

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = async (product: CreateProduct): Promise<Product> => {
    const res = await fetch(API_BASE, {
      method: "POST",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.fieldErrors?.name?.[0] || "Gagal menambah produk");
    }
    const newProduct = await res.json();
    setProducts((prev) => [...prev, newProduct]);
    return newProduct;
  };

  const updateProduct = async (id: number, updates: UpdateProduct): Promise<Product> => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      credentials: 'include',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.fieldErrors?.name?.[0] || "Gagal mengupdate produk");
    }
    const updated = await res.json();
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const deleteProduct = async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE", credentials: 'include' });
    if (!res.ok) throw new Error("Gagal menghapus produk");
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Only fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [fetchProducts, user]);

  return {
    products,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
