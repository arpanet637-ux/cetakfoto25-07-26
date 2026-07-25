import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/react-app/App";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  Settings,
  FileText,
  LogOut,
  Building2,
  Receipt,
  ClipboardList,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/react-app/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Produk", path: "/produk" },
  { icon: ShoppingCart, label: "Pesanan", path: "/pesanan" },
  { icon: Receipt, label: "Transaksi", path: "/transaksi" },
  { icon: Wallet, label: "Keuangan", path: "/keuangan" },
  { icon: FileText, label: "Invoice", path: "/invoice" },
  { icon: Building2, label: "Cabang", path: "/cabang" },
  { icon: Settings, label: "Pengaturan", path: "/pengaturan" },
];

// Grouped menu for mobile bottom nav
const orderGroupPaths = ["/pesanan", "/transaksi", "/keuangan", "/invoice"];
const orderGroupItems = navItems.filter((item) => orderGroupPaths.includes(item.path));

// Mobile bottom nav items (excluding grouped ones, then add the group)
const mobileNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Produk", path: "/produk" },
  { icon: ClipboardList, label: "Bisnis", path: "group" }, // Special group item
  { icon: Building2, label: "Cabang", path: "/cabang" },
  { icon: Settings, label: "Pengaturan", path: "/pengaturan" },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  // Check if current path is in the order group
  const isInOrderGroup = orderGroupPaths.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  // Close group menu on route change
  useEffect(() => {
    setShowGroupMenu(false);
  }, [location.pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGroupMenu(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 bg-sidebar text-sidebar-foreground lg:block">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">BisnisKu</span>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User & Logout */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-4">
          {user && (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {(user.email ?? "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
          <p className="mt-3 text-xs text-sidebar-foreground/50">
            © 2025 BisnisKu v1.0
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
        <div className="flex items-center justify-around">
          {mobileNavItems.map((item) => {
            if (item.path === "group") {
              // Special group button
              return (
                <button
                  key="group"
                  onClick={() => setShowGroupMenu(!showGroupMenu)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                    isInOrderGroup || showGroupMenu
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <div className="relative">
                    <item.icon className="h-5 w-5" />
                    {showGroupMenu && (
                      <ChevronUp className="absolute -right-3 -top-1 h-3 w-3" />
                    )}
                  </div>
                  <span>{item.label}</span>
                </button>
              );
            }

            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Group Menu Popup */}
      {showGroupMenu && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setShowGroupMenu(false)}
          />
          <div className="fixed bottom-[68px] left-4 right-4 z-50 rounded-xl border border-border bg-card p-2 shadow-xl lg:hidden">
            <div className="mb-2 flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-foreground">Menu Bisnis</span>
              <button
                onClick={() => setShowGroupMenu(false)}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {orderGroupItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + "/");

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowGroupMenu(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg p-4 transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom padding spacer - add to pages */}
    </>
  );
}
