import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, LogOut, Plus, Trash2, ExternalLink, CheckCircle2, Loader2, Info, Zap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Mahmoud Pro AI IDE" }] }),
});

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg" style={{ background: "var(--gradient-hero)" }} />
            <span className="font-semibold">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="me-2 h-4 w-4" /> {t("nav.signout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("dash.workspace")}</h1>
            <p className="mt-1 text-muted-foreground">{t("dash.subtitle")}</p>
          </div>
          <Link to="/editor">
            <Button size="lg" className="gap-2"><Plus className="h-4 w-4" /> {t("dash.open_editor")}</Button>
          </Link>
        </div>

        <Tabs defaultValue="keys" className="mt-8">
          <TabsList>
            <TabsTrigger value="keys"><KeyRound className="me-2 h-4 w-4" /> {t("dash.keys")}</TabsTrigger>
            <TabsTrigger value="permissions"><ShieldCheck className="me-2 h-4 w-4" /> {t("dash.perms")}</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="mt-6"><ApiKeysPanel userId={user.id} /></TabsContent>
          <TabsContent value="permissions" className="mt-6"><PermissionsPanel userId={user.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>{children}</div>;
}

/* ---------------- API Keys (enhanced with links + how-to) ---------------- */
type ProviderInfo = {
  id: string;
  label: string;
  url: string;
  steps: { ar: string[]; en: string[] };
};

const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai", label: "OpenAI", url: "https://platform.openai.com/api-keys",
    steps: {
      ar: ["افتح platform.openai.com/api-keys", "سجّل دخول أو أنشئ حسابًا", "اضغط Create new secret key", "انسخ المفتاح والصقه هنا"],
      en: ["Open platform.openai.com/api-keys", "Sign in or create account", "Click Create new secret key", "Copy the key and paste here"],
    },
  },
  {
    id: "anthropic", label: "Anthropic (Claude)", url: "https://console.anthropic.com/settings/keys",
    steps: {
      ar: ["افتح console.anthropic.com", "اذهب إلى Settings → API Keys", "اضغط Create Key", "انسخ المفتاح والصقه هنا"],
      en: ["Open console.anthropic.com", "Go to Settings → API Keys", "Click Create Key", "Copy and paste here"],
    },
  },
  {
    id: "google", label: "Google Gemini", url: "https://aistudio.google.com/app/apikey",
    steps: {
      ar: ["افتح aistudio.google.com/app/apikey", "سجّل دخول بحساب Google", "اضغط Create API key", "اختر مشروعًا وانسخ المفتاح"],
      en: ["Open aistudio.google.com/app/apikey", "Sign in with Google", "Click Create API key", "Select a project and copy"],
    },
  },
  {
    id: "groq", label: "Groq", url: "https://console.groq.com/keys",
    steps: {
      ar: ["افتح console.groq.com/keys", "أنشئ حسابًا مجانيًا", "اضغط Create API Key", "انسخ المفتاح والصقه هنا"],
      en: ["Open console.groq.com/keys", "Create a free account", "Click Create API Key", "Copy and paste here"],
    },
  },
  {
    id: "github", label: "GitHub Token", url: "https://github.com/settings/tokens/new",
    steps: {
      ar: ["افتح github.com/settings/tokens/new", "اختر صلاحيات: repo, workflow", "اضغط Generate token", "انسخ التوكن فورًا (لن يظهر مرة أخرى)"],
      en: ["Open github.com/settings/tokens/new", "Select scopes: repo, workflow", "Click Generate token", "Copy immediately (shown once)"],
    },
  },
  {
    id: "vercel", label: "Vercel", url: "https://vercel.com/account/tokens",
    steps: {
      ar: ["افتح vercel.com/account/tokens", "اضغط Create Token", "اختر صلاحية Full Account", "انسخ التوكن"],
      en: ["Open vercel.com/account/tokens", "Click Create Token", "Choose Full Account scope", "Copy the token"],
    },
  },
];

function ApiKeysPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [tests, setTests] = useState<Record<string, { state: "idle" | "loading" | "ok" | "fail"; info?: string }>>({});
  const current = PROVIDERS.find((p) => p.id === provider)!;

  async function testKey(id: string, prov: string, value: string) {
    setTests((s) => ({ ...s, [id]: { state: "loading" } }));
    try {
      const { data, error } = await supabase.functions.invoke("test-api-key", { body: { provider: prov, key: value } });
      if (error) throw error;
      if (data?.ok) {
        setTests((s) => ({ ...s, [id]: { state: "ok", info: data.info } }));
        toast.success(`✓ ${prov}: ${data.info ?? "connected"}`);
      } else {
        setTests((s) => ({ ...s, [id]: { state: "fail", info: data?.error } }));
        toast.error(`✗ ${prov}: ${data?.error ?? "failed"}`);
      }
    } catch (e: any) {
      setTests((s) => ({ ...s, [id]: { state: "fail", info: e.message } }));
      toast.error(e.message);
    }
  }

  const { data: keys = [] } = useQuery({
    queryKey: ["keys", userId],
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!keyValue.trim()) throw new Error("Key required");
      const { error } = await supabase.from("api_keys").insert({
        user_id: userId, provider, label: label || null, key_value: keyValue.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setKeyValue(""); setLabel("");
      qc.invalidateQueries({ queryKey: ["keys", userId] });
      toast.success("✓");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys", userId] }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <h3 className="font-semibold">{t("keys.add")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("keys.scoped")}</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>{t("keys.provider")}</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={current.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="me-2 h-3 w-3" /> {t("keys.get")} — {current.label}
                </a>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost"><Info className="me-2 h-3 w-3" /> {t("keys.how")}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <h4 className="mb-2 font-semibold">{current.label}</h4>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    {current.steps[lang].map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                  <Button asChild size="sm" className="mt-3 w-full">
                    <a href={current.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="me-2 h-3 w-3" /> {t("keys.get")}
                    </a>
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label>{t("keys.label")}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Personal" />
          </div>
          <div>
            <Label>{t("keys.value")}</Label>
            <Input type="password" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="sk-..." />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
            <Plus className="me-2 h-4 w-4" /> {t("keys.save")}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold">{t("keys.saved")}</h3>
        <div className="mt-4 space-y-2">
          {keys.length === 0 && <p className="text-sm text-muted-foreground">{t("keys.none")}</p>}
          {keys.map((k) => {
            const tr = tests[k.id];
            return (
              <div key={k.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="secondary">{k.provider}</Badge>
                    {k.label && <span className="truncate">{k.label}</span>}
                    {tr?.state === "ok" && <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="me-1 h-3 w-3" />{tr.info ?? "OK"}</Badge>}
                    {tr?.state === "fail" && <Badge variant="destructive"><XCircle className="me-1 h-3 w-3" />{tr.info ?? "Fail"}</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground truncate">
                    {k.key_value.slice(0, 6)}••••••{k.key_value.slice(-4)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => testKey(k.id, k.provider, k.key_value)} disabled={tr?.state === "loading"}>
                  {tr?.state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Zap className="me-1 h-3 w-3" /> Test</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(k.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- (Connected Accounts removed: GitHub OAuth unsupported) ---------------- */

/* ---------------- Permissions ---------------- */
const PERMS = [
  { id: "read_files", label: "Read Files" },
  { id: "write_files", label: "Write Files" },
  { id: "execute_builds", label: "Execute Builds" },
  { id: "deploy_projects", label: "Deploy Projects" },
  { id: "access_github", label: "Access GitHub" },
  { id: "run_terminal", label: "Run Terminal" },
  { id: "install_packages", label: "Install Packages" },
] as const;

function PermissionsPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["perms", userId],
    queryFn: async () => {
      const { data } = await supabase.from("agent_permissions").select("*").eq("user_id", userId).maybeSingle();
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const row = { user_id: userId, ...data, ...patch, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("agent_permissions").upsert(row, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perms", userId] }),
  });

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Agent Permissions</h3>
      </div>
      <div className="mt-6 divide-y divide-border">
        {PERMS.map((p) => {
          const value = (data as any)?.[p.id] ?? (p.id === "read_files");
          return (
            <div key={p.id} className="flex items-center justify-between py-3">
              <div className="font-medium">{p.label}</div>
              <Switch checked={!!value} onCheckedChange={(v) => save.mutate({ [p.id]: v })} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
