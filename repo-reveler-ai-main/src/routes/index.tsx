import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, ShieldCheck, Rocket, Code2, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Mahmoud Pro AI IDE — Real AI Development Platform" },
      { name: "description", content: "AI editor with live preview, secure API keys, publish & download." },
    ],
  }),
});

function Landing() {
  const { t } = useI18n();
  const features = [
    { icon: Code2, title: t("editor.title"), desc: t("editor.ai.placeholder") },
    { icon: Eye, title: t("editor.preview"), desc: t("landing.desc") },
    { icon: KeyRound, title: t("dash.keys"), desc: t("keys.scoped") },
    { icon: ShieldCheck, title: t("dash.perms"), desc: t("dash.subtitle") },
    { icon: Rocket, title: t("editor.publish"), desc: t("landing.desc") },
    { icon: Sparkles, title: t("editor.ai"), desc: t("editor.ai.placeholder") },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-glow)" }} />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-hero)" }} />
          <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link to="/login"><Button variant="ghost">{t("nav.signin")}</Button></Link>
          <Link to="/login"><Button>{t("nav.start")}</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t("landing.tag")}
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            {t("landing.title")}{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              {t("landing.title.accent")}
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">{t("landing.desc")}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/login"><Button size="lg">{t("landing.cta.start")}</Button></Link>
            <Link to="/login"><Button size="lg" variant="outline">{t("landing.cta.email")}</Button></Link>
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
