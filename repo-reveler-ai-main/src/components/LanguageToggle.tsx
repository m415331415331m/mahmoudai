import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ size = "sm" }: { size?: "sm" | "default" | "icon" }) {
  const { t, toggle } = useI18n();
  return (
    <Button variant="outline" size={size} onClick={toggle} className="gap-2">
      <Languages className="h-4 w-4" />
      {t("lang.toggle")}
    </Button>
  );
}
