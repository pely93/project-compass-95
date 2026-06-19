import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: RoleRedirect,
});

function RoleRedirect() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role) {
      navigate({ to: role === "developer" ? "/technical" : "/executive", replace: true });
    }
  }, [role, loading, navigate]);
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
