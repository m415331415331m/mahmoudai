import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Mahmoud Pro AI IDE" }] }),
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast.error((result.error as any).message ?? "Google sign-in failed");
        setLoading(false); return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-glow)" }} />
      <div className="absolute top-4 end-4"><LanguageToggle /></div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-card)" }}>
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg" style={{ background: "var(--gradient-hero)" }} />
          <span className="font-semibold">{t("app.name")}</span>
        </Link>
        <h1 className="text-2xl font-bold">{t("auth.welcome")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <Button onClick={handleGoogle} disabled={loading} className="mt-6 w-full gap-2" size="lg">
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.46-1.7 4.29-5.27 4.29-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.78 3.93 14.74 3 12.18 3 6.97 3 2.75 7.22 2.75 12.45s4.22 9.45 9.43 9.45c5.45 0 9.06-3.83 9.06-9.22 0-.62-.07-1.09-.15-1.58z"/></svg>
          {t("auth.google")}
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
          </TabsList>
          <TabsContent value={mode}>
            <form onSubmit={handleEmail} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2" variant="secondary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {mode === "signup" ? t("auth.create") : t("auth.signin")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
