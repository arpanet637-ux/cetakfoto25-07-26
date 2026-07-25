import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
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
      const { data, error: err } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (err) throw new Error(err.message);
      setProducts(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = async (product: CreateProduct): Promise<Product> => {
    const { data, error: err } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setProducts((prev) => [...prev, data]);
    return data;
  };

  const updateProduct = async (id: number, updates: UpdateProduct): Promise<Product> => {
    const { data, error: err } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
    return data;
  };

  const deleteProduct = async (id: number): Promise<void> => {
    const { error: err } = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    if (err) throw new Error(err.message);
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
