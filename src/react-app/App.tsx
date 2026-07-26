import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/react-app/lib/supabase";
import type { User, Session } from "@/react-app/lib/local-auth";
import HomePage from "@/react-app/pages/Home";
import ProdukPage from "@/react-app/pages/Produk";
import PesananPage from "@/react-app/pages/Pesanan";
import KeuanganPage from "@/react-app/pages/Keuangan";
import InvoicePage from "@/react-app/pages/Invoice";
import PengaturanPage from "@/react-app/pages/Pengaturan";
import CabangPage from "@/react-app/pages/Cabang";
import TransaksiPage from "@/react-app/pages/Transaksi";
import LoginPage from "@/react-app/pages/Login";
import CekAntrianPage from "@/react-app/pages/CekAntrian";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isPending: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isPending: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsPending(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsPending(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isPending, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/cek-antrian" element={<CekAntrianPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/produk" element={<ProtectedRoute><ProdukPage /></ProtectedRoute>} />
      <Route path="/pesanan" element={<ProtectedRoute><PesananPage /></ProtectedRoute>} />
      <Route path="/keuangan" element={<ProtectedRoute><KeuanganPage /></ProtectedRoute>} />
      <Route path="/invoice" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />
      <Route path="/pengaturan" element={<ProtectedRoute><PengaturanPage /></ProtectedRoute>} />
      <Route path="/cabang" element={<ProtectedRoute><CabangPage /></ProtectedRoute>} />
      <Route path="/transaksi" element={<ProtectedRoute><TransaksiPage /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
