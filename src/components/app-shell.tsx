import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Code2, LogOut, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name,email").eq("id", user!.id).maybeSingle();
      return data;
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

  const navItems = [
    isDev && { to: "/technical" as const, label: "Panel técnico", icon: Code2 },
    isPM && { to: "/executive" as const, label: "Panel ejecutivo", icon: LayoutDashboard },
  ].filter(Boolean) as { to: "/technical" | "/executive"; label: string; icon: typeof Code2 }[];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">WP</span>
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Project Tracker</div>
              <div className="text-[11px] text-muted-foreground">WordPress migration</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
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
                <Icon className="h-4 w-4" />
                {item.label}
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

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
