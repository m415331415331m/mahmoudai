import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // Wait for session to be established by supabase-js URL handler
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        toast.error("Sign in failed");
        navigate({ to: "/login" });
        return;
      }

      // If GitHub provider, persist token to github_connections
      const providerToken = (session as any).provider_token as string | undefined;
      const userMeta = session.user.user_metadata as any;
      if (providerToken && session.user.app_metadata?.provider === "github") {
        await supabase.from("github_connections").upsert(
          {
            user_id: session.user.id,
            access_token: providerToken,
            github_username: userMeta?.user_name ?? userMeta?.preferred_username ?? null,
            github_user_id: userMeta?.provider_id ?? null,
            avatar_url: userMeta?.avatar_url ?? null,
            scopes: ["read:user", "user:email", "repo", "workflow"],
            connected_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        toast.success("GitHub connected");
      }

      navigate({ to: "/dashboard" });
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Finishing sign in…
      </div>
    </div>
  );
}
