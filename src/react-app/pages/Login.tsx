import { useState } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { DEFAULT_EMAIL, DEFAULT_PASSWORD } from "@/react-app/lib/local-auth";
import { Printer } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg mb-4">
            <Printer className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">BisnisKu</h1>
          <p className="text-gray-500 mt-2">Kelola bisnis cetak foto Anda</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-6">
            {isSignUp ? "Buat Akun Baru" : "Masuk ke Akun Anda"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-medium"
            >
              {loading ? "Memuat..." : isSignUp ? "Daftar" : "Masuk"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              {isSignUp ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
            </button>
          </div>

          {!isSignUp && (
            <div className="mt-6 rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-center">
              <p className="text-xs text-gray-600">
                Akun bawaan: <span className="font-medium text-gray-800">{DEFAULT_EMAIL}</span> / {DEFAULT_PASSWORD}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail(DEFAULT_EMAIL);
                  setPassword(DEFAULT_PASSWORD);
                  setError(null);
                }}
                className="mt-1 text-xs font-medium text-teal-700 hover:text-teal-800 underline"
              >
                Isi otomatis
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          &copy; 2025 BisnisKu v1.0
        </p>
      </div>
    </div>
  );
}
