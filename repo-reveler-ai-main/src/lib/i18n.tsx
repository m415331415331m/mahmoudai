import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "ar" | "en";

const dict = {
  ar: {
    "app.name": "محمود برو AI IDE",
    "nav.signin": "تسجيل الدخول",
    "nav.start": "ابدأ الآن",
    "nav.signout": "تسجيل الخروج",
    "lang.toggle": "English",
    "landing.tag": "منصة تطوير AI احترافية حقيقية",
    "landing.title": "محرر أكواد ذكي مع",
    "landing.title.accent": "معاينة حية ونشر فوري",
    "landing.desc": "اربط حساباتك، أضف مفاتيح API، امنح الذكاء الاصطناعي صلاحيات، وابنِ تطبيقاتك من البداية للنشر.",
    "landing.cta.start": "ابدأ مجانًا",
    "landing.cta.email": "الدخول بالبريد",
    "auth.welcome": "مرحبًا بعودتك",
    "auth.subtitle": "سجّل الدخول للوصول إلى مساحة العمل.",
    "auth.google": "المتابعة باستخدام Google",
    "auth.or": "أو",
    "auth.signin": "دخول",
    "auth.signup": "حساب جديد",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.create": "إنشاء حساب",
    "dash.workspace": "مساحة العمل",
    "dash.subtitle": "أدر الاتصالات، المفاتيح، وصلاحيات الذكاء الاصطناعي.",
    "dash.open_editor": "فتح المحرر الذكي",
    "dash.accounts": "الحسابات المرتبطة",
    "dash.keys": "مفاتيح API",
    "dash.perms": "صلاحيات الوكيل",
    "keys.add": "إضافة مفتاح مزوّد",
    "keys.scoped": "محفوظ بأمان، مرتبط بحسابك فقط.",
    "keys.provider": "المزوّد",
    "keys.label": "وصف (اختياري)",
    "keys.value": "المفتاح",
    "keys.save": "حفظ المفتاح",
    "keys.saved": "المفاتيح المحفوظة",
    "keys.none": "لا توجد مفاتيح بعد.",
    "keys.get": "احصل على المفتاح",
    "keys.how": "كيف أحصل عليه؟",
    "editor.title": "المحرر الذكي",
    "editor.projects": "المشاريع",
    "editor.files": "الملفات",
    "editor.new_project": "مشروع جديد",
    "editor.new_file": "ملف جديد",
    "editor.create": "إنشاء",
    "editor.save": "حفظ",
    "editor.download": "تنزيل ZIP",
    "editor.publish": "نشر",
    "editor.code": "الكود",
    "editor.preview": "معاينة حية",
    "editor.ai": "مساعد الذكاء الاصطناعي",
    "editor.ai.placeholder": "اكتب ما تريد بناءه أو تعديله... (مثال: أنشئ زر تسجيل دخول مع تحقق)",
    "editor.ai.thinking": "الذكاء الاصطناعي يكتب...",
    "editor.no_file": "اختر أو أنشئ ملفًا",
    "editor.no_project": "أنشئ مشروعًا للبدء",
    "editor.no_projects": "لا توجد مشاريع بعد",
    "common.back": "رجوع",
    "common.delete": "حذف",
    "common.connected": "متصل",
    "common.disconnect": "فصل",
  },
  en: {
    "app.name": "Mahmoud Pro AI IDE",
    "nav.signin": "Sign in",
    "nav.start": "Get started",
    "nav.signout": "Sign out",
    "lang.toggle": "العربية",
    "landing.tag": "Production-ready professional AI platform",
    "landing.title": "Real AI IDE with",
    "landing.title.accent": "live preview & deploy",
    "landing.desc": "Connect accounts, add API keys, grant agent permissions, and ship apps end‑to‑end.",
    "landing.cta.start": "Start free",
    "landing.cta.email": "Email sign in",
    "auth.welcome": "Welcome back",
    "auth.subtitle": "Sign in to access your AI workspace.",
    "auth.google": "Continue with Google",
    "auth.or": "or",
    "auth.signin": "Sign in",
    "auth.signup": "Sign up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.create": "Create account",
    "dash.workspace": "Workspace",
    "dash.subtitle": "Manage connections, keys, and agent permissions.",
    "dash.open_editor": "Open AI Editor",
    "dash.accounts": "Connected Accounts",
    "dash.keys": "API Keys",
    "dash.perms": "Agent Permissions",
    "keys.add": "Add provider key",
    "keys.scoped": "Stored securely, scoped to your account.",
    "keys.provider": "Provider",
    "keys.label": "Label (optional)",
    "keys.value": "API Key",
    "keys.save": "Save key",
    "keys.saved": "Saved keys",
    "keys.none": "No keys yet.",
    "keys.get": "Get key",
    "keys.how": "How to get it",
    "editor.title": "AI Editor",
    "editor.projects": "Projects",
    "editor.files": "Files",
    "editor.new_project": "New Project",
    "editor.new_file": "New File",
    "editor.create": "Create",
    "editor.save": "Save",
    "editor.download": "Download ZIP",
    "editor.publish": "Publish",
    "editor.code": "Code",
    "editor.preview": "Live Preview",
    "editor.ai": "AI Assistant",
    "editor.ai.placeholder": "Describe what to build or change... (e.g., create a login form with validation)",
    "editor.ai.thinking": "AI is writing...",
    "editor.no_file": "Select or create a file",
    "editor.no_project": "Create a project to start",
    "editor.no_projects": "No projects yet",
    "common.back": "Back",
    "common.delete": "Delete",
    "common.connected": "Connected",
    "common.disconnect": "Disconnect",
  },
} as const;

type Key = keyof typeof dict.en;

interface I18nCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (k: Key) => string;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const Ctx = createContext<I18nCtx>({
  lang: "ar", dir: "rtl", t: (k) => k as string, setLang: () => {}, toggle: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? localStorage.getItem("lang") : null) as Lang | null;
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  return (
    <Ctx.Provider
      value={{
        lang,
        dir: lang === "ar" ? "rtl" : "ltr",
        t: (k) => (dict[lang] as any)[k] ?? (dict.en as any)[k] ?? k,
        setLang,
        toggle: () => setLang(lang === "ar" ? "en" : "ar"),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useI18n = () => useContext(Ctx);
