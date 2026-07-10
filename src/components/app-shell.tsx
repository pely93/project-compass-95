import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Code2, LogOut, Loader2, History, Settings, FileText, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name").eq("id", user!.id).maybeSingle();
      return data ? { ...data, email: user?.email ?? "" } : null;
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDev = role === "developer";
  const isPM = role === "project_manager";

  type NavTo = "/technical" | "/executive" | "/documents" | "/activity" | "/settings";
  const navItems = [
    isDev && { to: "/technical" as NavTo, label: "Panel técnico", icon: Code2 },
    isPM && { to: "/executive" as NavTo, label: "Panel ejecutivo", icon: LayoutDashboard },
    { to: "/documents" as NavTo, label: "Documentos", icon: FileText },
    { to: "/activity" as NavTo, label: "Actividad", icon: History },
    { to: "/settings" as NavTo, label: "Ajustes", icon: Settings },
  ].filter(Boolean) as { to: NavTo; label: string; icon: typeof Code2 }[];

  const sidebar = (
    <aside
      className={`w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:static md:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 shrink-0 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">PT</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">Project Tracker</div>
            <div className="text-[11px] text-muted-foreground truncate">Seguimiento interno</div>
          </div>
        </div>
        <button
          className="md:hidden text-muted-foreground hover:text-foreground p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="px-2 py-2">
          <div className="text-sm font-medium truncate">{profile?.name ?? "Usuario"}</div>
          <div className="text-[11px] text-muted-foreground truncate">{profile?.email}</div>
          <div className="text-[10px] uppercase tracking-wide text-primary mt-1">
            {isDev ? "Developer" : isPM ? "Project Manager" : "—"}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex">
      {sidebar}

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 py-2 border-b border-sidebar-border bg-background/95 backdrop-blur">
          <button
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 shrink-0 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-primary text-[10px] font-bold">PT</span>
            </div>
            <span className="text-sm font-semibold truncate">Project Tracker</span>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
