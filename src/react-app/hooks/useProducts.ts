import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/react-app/App";
import type { Product, CreateProduct, UpdateProduct } from "@/shared/types";

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error(`Failed to fetch products: ${response.statusText}`);
      const data = await response.json();
      setProducts(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = async (product: CreateProduct): Promise<Product> => {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!response.ok) throw new Error(`Failed to create product: ${response.statusText}`);
    const data = await response.json();
    setProducts((prev) => [...prev, data]);
    return data;
  };

  const updateProduct = async (id: number, updates: UpdateProduct): Promise<Product> => {
    const response = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!response.ok) throw new Error(`Failed to update product: ${response.statusText}`);
    const data = await response.json();
    setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
    return data;
  };

  const deleteProduct = async (id: number): Promise<void> => {
    const response = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) throw new Error(`Failed to delete product: ${response.statusText}`);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

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
