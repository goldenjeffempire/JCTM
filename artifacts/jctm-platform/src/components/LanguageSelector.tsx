import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check, Loader2, ChevronDown } from "lucide-react";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage, isTranslating } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const current = LANGUAGES[language] ?? LANGUAGES.en;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/50"
        title="Change language"
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
              className="absolute right-0 top-full mt-1 z-50 glass-panel border border-border rounded-2xl shadow-xl overflow-hidden"
              style={{ width: "220px", maxHeight: "380px", overflowY: "auto" }}
            >
              <div className="p-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
                  Select Language
                </div>
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => { setLanguage(code); setIsOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <div>
                        <div className="font-medium text-foreground">{lang.nativeName}</div>
                        <div className="text-xs text-muted-foreground">{lang.name}</div>
                      </div>
                    </div>
                    {language === code && <Check className="w-4 h-4 text-sky-500" />}
                  </button>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground text-center">
                  50+ languages via AI translation
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
