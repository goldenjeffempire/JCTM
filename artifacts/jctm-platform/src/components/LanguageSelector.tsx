import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check, Loader2, ChevronDown, Search } from "lucide-react";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage, isTranslating, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const current = LANGUAGES[language] ?? LANGUAGES.en;

  const filtered = query.trim()
    ? Object.entries(LANGUAGES).filter(([code, lang]) =>
        lang.name.toLowerCase().includes(query.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(query.toLowerCase()) ||
        code.toLowerCase().includes(query.toLowerCase())
      )
    : Object.entries(LANGUAGES);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/50"
        title={t("Select Language")}
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Globe className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{current.flag} {current.nativeName}</span>
        <span className="sm:hidden">{current.flag}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 z-50 glass-panel border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col"
              style={{ width: "240px", maxHeight: "420px" }}
            >
              {/* Search bar */}
              <div className="p-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/50 border border-border">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search languages…"
                    className="text-xs bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              {/* Language list */}
              <div className="overflow-y-auto flex-1 p-1.5">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No languages found</p>
                ) : (
                  filtered.map(([code, lang]) => (
                    <button
                      key={code}
                      onClick={() => { setLanguage(code); setIsOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{lang.flag}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-xs truncate">{lang.nativeName}</div>
                          <div className="text-[10px] text-muted-foreground">{lang.name}</div>
                        </div>
                      </div>
                      {language === code && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0 ml-1" />}
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-border shrink-0">
                <p className="text-[10px] text-muted-foreground text-center">
                  {t("50+ languages via AI translation")}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
