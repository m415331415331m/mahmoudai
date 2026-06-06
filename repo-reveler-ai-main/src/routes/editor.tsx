import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Loader2, Plus, Trash2, Download, Sparkles, FilePlus, FolderOpen, LogOut,
  ArrowLeft, Code2, Eye, Rocket, Send, MessageSquare, Copy, Share2, Square,
  ExternalLink, Pencil, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — Mahmoud Pro AI IDE" }] }),
});

type Project = { id: string; name: string; description: string | null };
type ProjectFile = { id: string; project_id: string; path: string; content: string; language: string | null };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function langFromPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", css: "css", html: "html", md: "markdown",
  };
  return map[ext] ?? "plaintext";
}

type ChatMsg = { id?: string; role: "user" | "assistant"; content: string; ts: number; streaming?: boolean; progress?: string };

function normalizePreviewPath(path: string, basePath = "") {
  if (!path) return "";
  if (/^(https?:|mailto:|tel:|data:|blob:|#)/i.test(path)) return path;
  const cleanBase = basePath.replace(/^\/+/, "").split("/").slice(0, -1).join("/");
  const joined = path.startsWith("/") ? path : [cleanBase, path].filter(Boolean).join("/");
  const parts: string[] = [];
  for (const part of joined.replace(/^\.\//, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function EditorPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, dir } = useI18n();

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string>("");
  const [view, setView] = useState<"code" | "preview">("code");
  const [chatOpen, setChatOpen] = useState(true);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishSuccessOpen, setPublishSuccessOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"files" | "main" | "chat">("chat");
  const [previewPath, setPreviewPath] = useState("index.html");
  const [streamingPaths, setStreamingPaths] = useState<string[]>([]);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function quickNewProject() {
    if (!user) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: "محادثة جديدة", user_id: user.id })
      .select().single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["projects"] });
    setActiveProjectId((data as Project).id);
    setActiveFileId(null);
    setChat([]);
    setMobilePane("chat");
    toast.success("✓ محادثة جديدة");
  }
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => { chatScrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [chat]);

  const projectsQ = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  useEffect(() => {
    if (!activeProjectId && projectsQ.data && projectsQ.data.length > 0) setActiveProjectId(projectsQ.data[0].id);
  }, [projectsQ.data, activeProjectId]);

  // Load persisted chat & published URL whenever active project changes
  useEffect(() => {
    if (!activeProjectId) { setChat([]); setPublishedUrl(null); return; }
    (async () => {
      const [{ data: msgs }, { data: proj }] = await Promise.all([
        supabase.from("chat_messages").select("*").eq("project_id", activeProjectId).order("created_at"),
        supabase.from("projects").select("published_url").eq("id", activeProjectId).single(),
      ]);
      setChat((msgs ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content, ts: new Date(m.created_at).getTime() })));
      setPublishedUrl((proj as any)?.published_url ?? null);
    })();
  }, [activeProjectId]);

  const filesQ = useQuery({
    queryKey: ["files", activeProjectId],
    enabled: !!activeProjectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_files").select("*").eq("project_id", activeProjectId!).order("path");
      if (error) throw error;
      return data as ProjectFile[];
    },
  });

  const activeFile = useMemo(() => filesQ.data?.find((f) => f.id === activeFileId) ?? null, [filesQ.data, activeFileId]);

  useEffect(() => { if (activeFile) setDraftContent(activeFile.content); }, [activeFile?.id]);
  useEffect(() => {
    if (!activeFileId && filesQ.data && filesQ.data.length > 0) setActiveFileId(filesQ.data[0].id);
  }, [filesQ.data, activeFileId]);

  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("projects").insert({ name, user_id: user!.id }).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setActiveProjectId(p.id); setActiveFileId(null);
      setNewProjOpen(false); setNewProjName("");
      toast.success("✓");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setActiveProjectId(null); setActiveFileId(null);
    },
  });

  const createFile = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.from("project_files").insert({
        project_id: activeProjectId!, user_id: user!.id, path, content: "", language: langFromPath(path),
      }).select().single();
      if (error) throw error;
      return data as ProjectFile;
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["files", activeProjectId] });
      setActiveFileId(f.id); setNewFileOpen(false); setNewFilePath("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files", activeProjectId] });
      setActiveFileId(null);
    },
  });

  const saveFile = useMutation({
    mutationFn: async () => {
      if (!activeFile) return;
      const { error } = await supabase.from("project_files")
        .update({ content: draftContent, updated_at: new Date().toISOString() })
        .eq("id", activeFile.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["files", activeProjectId] }); toast.success("✓"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function persistMsg(role: "user" | "assistant", content: string) {
    if (!activeProjectId || !user) return;
    try {
      await supabase.from("chat_messages").insert({ project_id: activeProjectId, user_id: user.id, role, content });
    } catch { /* non-fatal */ }
  }

  async function runAI() {
    if (!aiPrompt.trim() || aiBusy || !user) return;
    setStreamingPaths([]);

    // Auto-create a project from the prompt if none is active (no dialog needed)
    let projectId = activeProjectId;
    if (!projectId) {
      const autoName = aiPrompt.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 60) || "New Project";
      const { data: newProj, error: pErr } = await supabase
        .from("projects").insert({ name: autoName, user_id: user.id }).select().single();
      if (pErr || !newProj) { toast.error(pErr?.message ?? "Couldn't create project"); return; }
      projectId = (newProj as Project).id;
      setActiveProjectId(projectId);
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`✓ ${autoName}`);
    }

    const userMsg: ChatMsg = { role: "user", content: aiPrompt, ts: Date.now() };
    const prompt = aiPrompt;
    setAiPrompt("");
    setChat((c) => [...c, userMsg, { role: "assistant", content: "", ts: Date.now(), streaming: true, progress: "🧠 Thinking…" }]);
    setAiBusy(true);
    try { await supabase.from("chat_messages").insert({ project_id: projectId, user_id: user.id, role: "user", content: prompt }); } catch {}

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token ?? SUPABASE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          currentFile: activeFile?.path,
          currentContent: draftContent,
          files: filesQ.data?.map((f) => ({ path: f.path, content: f.id === activeFileId ? draftContent : f.content })) ?? [],
        }),
        signal: ctrl.signal,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        throw new Error(payload?.message ?? payload?.error ?? "AI failed");
      }
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        const splitIdx = full.indexOf("===FILES===");
        const visible = splitIdx >= 0 ? full.slice(0, splitIdx).trim() : full;
        let progress: string | undefined = "🧠 Thinking…";
        if (splitIdx >= 0) {
          const jsonChunk = full.slice(splitIdx + 11);
          const pathMatches = [...jsonChunk.matchAll(/"path"\s*:\s*"([^"]+)"/g)];
          if (pathMatches.length > 0) {
            const last = pathMatches[pathMatches.length - 1][1];
            setStreamingPaths(Array.from(new Set(pathMatches.map((match) => match[1]))));
            progress = `✍️ Writing ${pathMatches.length} file${pathMatches.length > 1 ? "s" : ""} · ${last}`;
          } else progress = "📦 Generating files…";
        }
        setChat((c) => {
          const next = [...c];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: visible, progress };
          return next;
        });
      }

      const splitIdx = full.indexOf("===FILES===");
      const explanation = splitIdx >= 0 ? full.slice(0, splitIdx).trim() : "";
      let jsonPart = splitIdx >= 0 ? full.slice(splitIdx + 11).trim() : full.trim();
      jsonPart = jsonPart.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let generated: Array<{ path: string; content: string; language?: string }> = [];
      try { generated = JSON.parse(jsonPart); } catch {
        const m = jsonPart.match(/\[[\s\S]*\]/);
        if (m) { try { generated = JSON.parse(m[0]); } catch {} }
      }

      let filesMsg = "";
      if (Array.isArray(generated) && generated.length > 0) {
        // Fetch existing files for this (possibly brand new) project
        const { data: existingFiles } = await supabase.from("project_files").select("id,path").eq("project_id", projectId);
        for (const g of generated) {
          const existing = existingFiles?.find((f: any) => f.path === g.path);
          if (existing) {
            await supabase.from("project_files").update({ content: g.content, language: g.language ?? langFromPath(g.path) }).eq("id", existing.id);
          } else {
            await supabase.from("project_files").insert({
              project_id: projectId, user_id: user.id,
              path: g.path, content: g.content, language: g.language ?? langFromPath(g.path),
            });
          }
        }
        qc.invalidateQueries({ queryKey: ["files", projectId] });
        setStreamingPaths(generated.map((g) => g.path));
        setPreviewPath(generated.some((g) => g.path === "index.html") ? "index.html" : generated.find((g) => g.path.endsWith(".html"))?.path ?? generated[0].path);
        filesMsg = `\n\n📦 ${generated.length} file(s):\n` + generated.map(g => `• ${g.path}`).join("\n");
        setView("preview");
        setMobilePane("main");
        setTimeout(() => publish(true).catch(() => {}), 500);
      }

      const finalContent = (explanation || "Done.") + filesMsg;
      setChat((c) => {
        const next = [...c];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: finalContent, streaming: false, progress: undefined };
        return next;
      });
      try { await supabase.from("chat_messages").insert({ project_id: projectId, user_id: user.id, role: "assistant", content: finalContent }); } catch {}
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "⏹ Stopped" : `❌ ${e.message ?? "AI failed"}`;
      setChat((c) => {
        const next = [...c];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: msg, streaming: false, progress: undefined };
        return next;
      });
      persistMsg("assistant", msg);
    } finally {
      setAiBusy(false);
      abortRef.current = null;
      setTimeout(() => setStreamingPaths([]), 1800);
    }
  }

  function stopAI() { abortRef.current?.abort(); }

  async function copyMsg(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("✓ Copied"); }
    catch { toast.error("Copy failed"); }
  }

  async function shareMsg(text: string) {
    if (navigator.share) { try { await navigator.share({ text }); } catch {} }
    else { await copyMsg(text); }
  }

  function startEditMessage(index: number, content: string) {
    setEditingMessageIndex(index);
    setEditingMessageText(content);
  }

  async function saveEditedMessage(index: number) {
    const nextText = editingMessageText.trim();
    if (!nextText) return;
    const target = chat[index];
    setChat((current) => current.map((msg, i) => (i === index ? { ...msg, content: nextText } : msg)));
    setEditingMessageIndex(null);
    setEditingMessageText("");
    if (target?.id) {
      await supabase.from("chat_messages").update({ content: nextText }).eq("id", target.id);
    }
    if (target?.role === "user") setAiPrompt(nextText);
  }

  const previewDeviceClass = "h-full w-full border-0 bg-background";

  async function exportZip() {
    if (!activeProjectId || !filesQ.data) return;
    const project = projectsQ.data?.find((p) => p.id === activeProjectId);
    const zip = new JSZip();
    for (const f of filesQ.data) zip.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project?.name ?? "project"}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("ZIP ✓");
  }

  function openPreviewInNewTab() {
    if (!previewSrcDoc) return;
    const blob = new Blob([previewSrcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function publish(silent = false) {
    const { data: freshFiles } = await supabase.from("project_files").select("*").eq("project_id", activeProjectId!).order("path");
    const files = (freshFiles ?? filesQ.data) as ProjectFile[] | undefined;
    if (!files || files.length === 0 || !activeProjectId || !user) {
      if (!silent) toast.error("No files");
      return;
    }
    if (!silent) setPublishing(true);
    try {
      const project = projectsQ.data?.find((p) => p.id === activeProjectId);
      const slug = (project?.name ?? "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
      const folder = `${user.id}/${slug}-${activeProjectId.slice(0, 8)}`;

      for (const f of files) {
        const path = f.path.replace(/^\/+/, "");
        const contentType =
          path.endsWith(".html") ? "text/html" :
          path.endsWith(".css") ? "text/css" :
          path.endsWith(".js") || path.endsWith(".jsx") ? "application/javascript" :
          path.endsWith(".json") ? "application/json" :
          path.endsWith(".svg") ? "image/svg+xml" :
          "text/plain; charset=utf-8";
        const { error } = await supabase.storage.from("published").upload(`${folder}/${path}`, new Blob([f.content], { type: contentType }), { upsert: true, contentType });
        if (error) throw error;
      }

      const hasIndex = files.some((f) => f.path.replace(/^\/+/, "") === "index.html");
      const entry = hasIndex ? "index.html" : files[0].path.replace(/^\/+/, "");
      const { data: pub } = supabase.storage.from("published").getPublicUrl(`${folder}/${entry}`);
      const url = pub.publicUrl;
      setPublishedUrl(url);
      await supabase.from("projects").update({ published_url: url }).eq("id", activeProjectId);

      if (!silent) {
        await navigator.clipboard.writeText(url).catch(() => {});
        setPublishSuccessOpen(true);
        toast.success("✓ Published");
      }
    } catch (e: any) {
      if (!silent) toast.error(e.message ?? "Publish failed");
    } finally {
      if (!silent) setPublishing(false);
    }
  }

  const sandpackFiles = useMemo(() => {
    const files: Record<string, string> = {};
    if (filesQ.data) {
      for (const f of filesQ.data) {
        const path = f.path.replace(/^\/+/, "");
        files[path] = f.id === activeFileId ? draftContent : f.content;
      }
    }
    return files;
  }, [filesQ.data, activeFileId, draftContent]);

  const previewPages = useMemo(
    () => Object.keys(sandpackFiles).filter((path) => path.toLowerCase().endsWith(".html")).sort(),
    [sandpackFiles],
  );

  const previewSrcDoc = useMemo(() => {
    const entry = sandpackFiles[previewPath] ? previewPath : previewPages[0];
    const raw = entry ? sandpackFiles[entry] : "";
    if (!raw) return "";
    const withStyles = raw.replace(/<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi, (_match, before, href, after) => {
      const cssPath = normalizePreviewPath(href.split("?")[0], entry);
      const css = sandpackFiles[cssPath];
      return css ? `<style data-preview-source="${cssPath}">\n${css}\n</style>` : `<link ${before} href="${href}" ${after}>`;
    });
    const withScripts = withStyles.replace(/<script\b([^>]*?)src=["']([^"']+\.js(?:\?[^"']*)?)["']([^>]*)>\s*<\/script>/gi, (_match, before, src, after) => {
      const jsPath = normalizePreviewPath(src.split("?")[0], entry);
      const js = sandpackFiles[jsPath];
      return js ? `<script ${before} ${after}>\n${js.replace(/<\/script>/gi, "<\\/script>")}\n</script>` : `<script ${before} src="${src}" ${after}></script>`;
    });
    const bridge = `<script>
      (() => {
        const entry = ${JSON.stringify(entry)};
        document.addEventListener('click', (event) => {
          const anchor = event.target.closest && event.target.closest('a[href]');
          if (!anchor) return;
          const href = anchor.getAttribute('href');
          if (!href || /^(https?:|mailto:|tel:|data:|blob:|#)/i.test(href)) return;
          event.preventDefault();
          window.parent.postMessage({ type: 'preview:navigate', path: href, base: entry }, '*');
        });
      })();
    </script>`;
    return withScripts.includes("</body>") ? withScripts.replace("</body>", `${bridge}</body>`) : `${withScripts}${bridge}`;
  }, [previewPages, previewPath, sandpackFiles]);

  useEffect(() => {
    if (previewPages.length > 0 && !sandpackFiles[previewPath]) setPreviewPath(previewPages.includes("index.html") ? "index.html" : previewPages[0]);
  }, [previewPages, previewPath, sandpackFiles]);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.data?.type !== "preview:navigate") return;
      const nextPath = normalizePreviewPath(event.data.path, event.data.base);
      if (sandpackFiles[nextPath]) setPreviewPath(nextPath);
    };
    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, [sandpackFiles]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background" dir={dir}>
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 md:px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-semibold">{t("editor.title")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {publishedUrl && (
            <Button size="sm" variant="ghost" onClick={() => window.open(publishedUrl, "_blank")} title={publishedUrl}>
              <ExternalLink className="me-2 h-4 w-4" /> Open
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => publish(false)} disabled={!activeProjectId || publishing}>
            {publishing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Rocket className="me-2 h-4 w-4" />}
            {t("editor.publish")}
          </Button>
          <Button size="sm" variant="outline" onClick={exportZip} disabled={!activeProjectId}>
            <Download className="me-2 h-4 w-4" /> {t("editor.download")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={`${mobilePane === "files" ? "flex" : "hidden"} md:flex min-h-0 w-full md:w-60 flex-col border-e border-border bg-card`}>

          <div className="flex items-center justify-between p-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">{t("editor.projects")}</span>
            <Dialog open={newProjOpen} onOpenChange={setNewProjOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("editor.new_project")}</DialogTitle></DialogHeader>
                <Input placeholder="My App" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
                <DialogFooter>
                  <Button onClick={() => createProject.mutate(newProjName)} disabled={!newProjName || createProject.isPending}>{t("editor.create")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-1 px-2 pb-2">
            {projectsQ.data?.map((p) => (
              <div key={p.id} className={`group flex items-center justify-between rounded px-2 py-1 text-sm cursor-pointer ${activeProjectId === p.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"}`}
                   onClick={() => { setActiveProjectId(p.id); setActiveFileId(null); }}>
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className="h-3 w-3 shrink-0" /><span className="truncate">{p.name}</span>
                </div>
                <button className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete?`)) deleteProject.mutate(p.id); }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
            {projectsQ.data?.length === 0 && <p className="px-2 text-xs text-muted-foreground">{t("editor.no_projects")}</p>}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border p-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">{t("editor.files")}</span>
            <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!activeProjectId}>
                  <FilePlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("editor.new_file")}</DialogTitle></DialogHeader>
                <Input placeholder="src/index.tsx" value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} />
                <DialogFooter>
                  <Button onClick={() => createFile.mutate(newFilePath)} disabled={!newFilePath || createFile.isPending}>{t("editor.create")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {streamingPaths.length > 0 && (
            <div className="mx-2 mb-2 rounded-md border border-border bg-accent/60 p-2 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary" /> جاري إنشاء الملفات
              </div>
              <div className="space-y-1">
                {streamingPaths.slice(0, 8).map((path) => (
                  <div key={path} className="truncate font-mono">{path}</div>
                ))}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-2">
            {filesQ.data?.map((f) => (
              <div key={f.id} className={`group flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer ${activeFileId === f.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"}`}
                   onClick={() => { setActiveFileId(f.id); if (f.path.endsWith(".html")) { setPreviewPath(f.path); setView("preview"); setMobilePane("main"); } }}>
                <span className="flex min-w-0 items-center gap-1 truncate font-mono">
                  {streamingPaths.includes(f.path) && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
                  <span className="truncate">{f.path}</span>
                </span>
                <button className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete?`)) deleteFile.mutate(f.id); }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className={`${mobilePane === "main" ? "flex" : "hidden"} md:flex min-h-0 flex-1 flex-col min-w-0`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Button size="sm" variant={view === "code" ? "secondary" : "ghost"} onClick={() => setView("code")}>
                <Code2 className="me-2 h-3 w-3" /> {t("editor.code")}
              </Button>
              <Button size="sm" variant={view === "preview" ? "secondary" : "ghost"} onClick={() => setView("preview")}>
                <Eye className="me-2 h-3 w-3" /> {t("editor.preview")}
              </Button>
              {view === "preview" && previewPages.length > 0 ? (
                <select
                  value={sandpackFiles[previewPath] ? previewPath : previewPages[0]}
                  onChange={(event) => setPreviewPath(event.target.value)}
                  className="ms-2 h-8 max-w-44 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  {previewPages.map((page) => <option key={page} value={page}>{page}</option>)}
                </select>
              ) : (
                <span className="ms-3 truncate font-mono text-xs text-muted-foreground">{activeFile?.path ?? ""}</span>
              )}
            </div>
            {activeFile && view === "code" && (
              <Button size="sm" variant="outline" onClick={() => saveFile.mutate()} disabled={saveFile.isPending}>
                {t("editor.save")}
              </Button>
            )}
            {view === "preview" && previewSrcDoc && (
              <Button size="sm" variant="outline" onClick={openPreviewInNewTab} className="gap-2">
                <ExternalLink className="h-3 w-3" /> فتح
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {view === "code" ? (
              activeFile ? (
                <Editor
                  height="100%"
                  theme="light"
                  language={activeFile.language ?? langFromPath(activeFile.path)}
                  value={draftContent}
                  onChange={(v) => setDraftContent(v ?? "")}
                  options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {activeProjectId ? t("editor.no_file") : t("editor.no_project")}
                </div>
              )
            ) : previewSrcDoc ? (
              <div className="flex h-full min-h-0 flex-col bg-background">
                <iframe
                  key={`${activeProjectId ?? "project"}:${previewPath}`}
                  title="Live site preview"
                  srcDoc={previewSrcDoc}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                  className={previewDeviceClass}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("editor.no_project")}
              </div>
            )}
          </div>
        </main>

        <aside className={`${mobilePane === "chat" ? "flex" : "hidden"} md:flex min-h-0 flex-col border-s border-border bg-card transition-all w-full ${chatOpen ? "md:w-96" : "md:w-12"}`}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2 gap-2">
            <button onClick={() => setChatOpen((o) => !o)} className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              {(chatOpen || mobilePane === "chat") && <span>{t("editor.ai")}</span>}
            </button>
            {(chatOpen || mobilePane === "chat") && (
              <Button size="sm" variant="outline" onClick={quickNewProject} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" /> محادثة جديدة
              </Button>
            )}
          </div>


          {(chatOpen || mobilePane === "chat") && (
            <>
              <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain p-3">
                {chat.length === 0 && (
                  <div className="rounded-lg bg-accent p-3 text-xs text-muted-foreground">
                    {t("editor.ai.placeholder")}
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`group rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground ms-6" : "bg-accent text-accent-foreground me-6"}`}>
                    {editingMessageIndex === i ? (
                      <div className="space-y-2">
                        <Textarea value={editingMessageText} onChange={(event) => setEditingMessageText(event.target.value)} className="min-h-24 resize-none bg-background text-foreground" autoFocus />
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingMessageIndex(null); setEditingMessageText(""); }}><X className="h-3 w-3" /></Button>
                          <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => saveEditedMessage(i)}><Check className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans">{m.content}{m.streaming && <span className="ms-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />}</pre>
                    )}
                    {m.streaming && m.progress && (
                      <div className="mt-2 text-xs opacity-70 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> {m.progress}
                      </div>
                    )}
                    {!m.streaming && m.content && (
                      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => startEditMessage(i, m.content)} className="rounded p-1 hover:bg-background/30" title="Edit">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => copyMsg(m.content)} className="rounded p-1 hover:bg-background/30" title="Copy">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button onClick={() => shareMsg(m.content)} className="rounded p-1 hover:bg-background/30" title="Share">
                          <Share2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3">
                <Textarea
                  rows={3}
                  placeholder={t("editor.ai.placeholder")}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAI(); }
                  }}
                  className="resize-none"
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={runAI} disabled={aiBusy || !aiPrompt.trim()} className="flex-1 gap-2">
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <Sparkles className="h-3 w-3" />
                  </Button>
                  {aiBusy && (
                    <Button variant="outline" onClick={stopAI} className="gap-1">
                      <Square className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Enter ↵ · Shift+Enter = newline</p>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="flex md:hidden border-t border-border bg-card">
        <button onClick={() => setMobilePane("files")} className={`flex-1 py-2 text-xs flex flex-col items-center gap-0.5 ${mobilePane === "files" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <FolderOpen className="h-4 w-4" /> الملفات
        </button>
        <button onClick={() => setMobilePane("main")} className={`flex-1 py-2 text-xs flex flex-col items-center gap-0.5 ${mobilePane === "main" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <Eye className="h-4 w-4" /> {view === "preview" ? "معاينة" : "كود"}
        </button>
        <button onClick={() => setMobilePane("chat")} className={`flex-1 py-2 text-xs flex flex-col items-center gap-0.5 ${mobilePane === "chat" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <MessageSquare className="h-4 w-4" /> محادثة
        </button>
      </nav>


      <Dialog open={publishSuccessOpen} onOpenChange={setPublishSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" /> ✓ تم النشر بنجاح
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">موقعك حي الآن على الإنترنت. انسخ الرابط وشاركه:</p>
            <div className="flex gap-2">
              <Input readOnly value={publishedUrl ?? ""} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="icon" variant="outline" onClick={() => { if (publishedUrl) { navigator.clipboard.writeText(publishedUrl); toast.success("✓ نسخ"); } }} title="نسخ">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={() => publishedUrl && window.open(publishedUrl, "_blank")}>
                <ExternalLink className="h-4 w-4" /> فتح في تبويب جديد
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => { if (publishedUrl && navigator.share) navigator.share({ url: publishedUrl }).catch(() => {}); }}>
                <Share2 className="h-4 w-4" /> مشاركة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
