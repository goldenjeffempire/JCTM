import { useEffect, useMemo, useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Share2,
  Mail,
  Link as LinkIcon,
  CheckCircle2,
  Smartphone,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DevotionSharePayload {
  title: string;
  scripture: string;
  reference: string;
  propheticWord: string;
  declaration: string;
  url?: string;
}

interface DevotionShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devotion: DevotionSharePayload;
}

type Channel =
  | "native"
  | "whatsapp"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "telegram"
  | "email"
  | "copy";

interface ChannelDef {
  id: Channel;
  label: string;
  hint: string;
  /** Full Tailwind class string for the icon disc (must be static so JIT picks it up). */
  disc: string;
  icon: (props: { className?: string }) => ReactElement;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.91h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.196 2.238.196v2.476h-1.26c-1.243 0-1.63.775-1.63 1.572v1.887h2.773l-.443 2.91h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939Z" />
    </svg>
  );
}

function XBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.554V9H7.12v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.65 6.835-1.553 7.32c-.117.52-.428.647-.866.402l-2.39-1.762-1.154 1.11c-.128.128-.235.235-.482.235l.172-2.443 4.45-4.022c.193-.172-.043-.268-.299-.097l-5.501 3.464-2.37-.74c-.515-.16-.527-.514.108-.762l9.276-3.578c.43-.158.804.097.665.873Z" />
    </svg>
  );
}

const CHANNELS: ChannelDef[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Chat or status",
    disc: "bg-[#25D366] group-hover:ring-[#25D366]/30",
    icon: WhatsAppIcon,
  },
  {
    id: "facebook",
    label: "Facebook",
    hint: "Wall or group",
    disc: "bg-[#1877F2] group-hover:ring-[#1877F2]/30",
    icon: FacebookIcon,
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    hint: "Post a thought",
    disc: "bg-black group-hover:ring-black/20",
    icon: XBrandIcon,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hint: "Faith at work",
    disc: "bg-[#0A66C2] group-hover:ring-[#0A66C2]/30",
    icon: LinkedInIcon,
  },
  {
    id: "telegram",
    label: "Telegram",
    hint: "Channel or DM",
    disc: "bg-[#229ED9] group-hover:ring-[#229ED9]/30",
    icon: TelegramIcon,
  },
  {
    id: "email",
    label: "Email",
    hint: "Send to a friend",
    disc: "bg-gradient-to-br from-slate-700 to-slate-900 group-hover:ring-slate-500/30",
    icon: ({ className }) => <Mail className={className} />,
  },
];

function buildShareText(d: DevotionSharePayload) {
  return `Today's Word from JCTM — "${d.title}"\n\n"${d.scripture}" — ${d.reference}\n\nProphetic Word: ${d.propheticWord}\n\nDeclaration: "${d.declaration}"\n\nJesus Christ Temple Ministry · jctm.org.ng`;
}

function buildShortText(d: DevotionSharePayload) {
  return `Today's Word from JCTM — "${d.title}"\n\n"${d.scripture}" — ${d.reference}`;
}

function openShareWindow(url: string) {
  const w = 640;
  const h = 580;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2.5;
  const features = `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
  const win = window.open(url, "jctm-share", features);
  if (!win) {
    // Popup blocked — fall back to same-tab navigation
    window.location.href = url;
  }
}

function ShareBody({
  devotion,
  onComplete,
}: {
  devotion: DevotionSharePayload;
  onComplete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () =>
      devotion.url ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/#daily-devotion`
        : "https://jctm.org.ng"),
    [devotion.url],
  );

  const fullText = useMemo(() => buildShareText(devotion), [devotion]);
  const shortText = useMemo(() => buildShortText(devotion), [devotion]);
  const encoded = encodeURIComponent;

  const supportsNative =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleChannel = async (id: Channel) => {
    let url = "";
    switch (id) {
      case "whatsapp":
        url = `https://wa.me/?text=${encoded(`${fullText}\n\n${shareUrl}`)}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encoded(shareUrl)}&quote=${encoded(shortText)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encoded(shortText)}&url=${encoded(shareUrl)}`;
        break;
      case "linkedin":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encoded(shareUrl)}`;
        break;
      case "telegram":
        url = `https://t.me/share/url?url=${encoded(shareUrl)}&text=${encoded(shortText)}`;
        break;
      case "email": {
        const subject = `Today's Word from JCTM — ${devotion.title}`;
        const body = `${fullText}\n\nRead it here: ${shareUrl}`;
        url = `mailto:?subject=${encoded(subject)}&body=${encoded(body)}`;
        // mailto: must use same-tab navigation, not popup
        window.location.href = url;
        toast.success("Opening your email app…");
        onComplete();
        return;
      }
    }
    if (url) openShareWindow(url);
    toast.success(`Sharing to ${CHANNELS.find((c) => c.id === id)?.label ?? "platform"}…`);
    onComplete();
  };

  const handleNative = async () => {
    try {
      await navigator.share({
        title: devotion.title,
        text: shortText,
        url: shareUrl,
      });
      toast.success("Shared. Thank you for spreading the Word.");
      onComplete();
    } catch (err) {
      // Most "errors" here are user-cancelled — silent
      if ((err as Error)?.name && (err as Error).name !== "AbortError") {
        toast.error("Couldn't open the share sheet.");
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${fullText}\n\n${shareUrl}`);
      setCopied(true);
      toast.success("Link & verse copied to clipboard.");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy. Long-press the link below to copy manually.");
    }
  };

  return (
    <div className="px-1 pb-1">
      {/* Preview card */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary/[0.04] to-accent/[0.06] border border-border/60 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Today's Word
        </p>
        <p className="mt-1.5 font-serif font-bold text-primary text-base sm:text-lg leading-snug text-balance">
          {devotion.title}
        </p>
        <p className="mt-2 font-serif italic text-primary/75 text-sm leading-snug line-clamp-2">
          <span aria-hidden className="text-accent/60">“</span>
          {devotion.scripture}
          <span aria-hidden className="text-accent/60">”</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-primary/55">
          — {devotion.reference}
        </p>
      </div>

      {/* Native share (when supported) */}
      {supportsNative && (
        <button
          type="button"
          onClick={handleNative}
          className="group w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-primary text-white hover:bg-primary/90 transition-all duration-200 elev-1 hover:elev-2 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
          data-testid="button-share-native"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 shrink-0">
            <Smartphone className="h-4 w-4" />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-[15px] font-semibold leading-tight">
              Share via your device
            </span>
            <span className="block text-[11px] text-white/70 mt-0.5">
              Use any installed app — fastest on mobile
            </span>
          </span>
          <Share2 className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* Platform grid */}
      <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/45">
        Share to a platform
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-5">
        {CHANNELS.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => handleChannel(c.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.94 }}
              aria-label={`Share to ${c.label}`}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-2.5 sm:p-3 hover:bg-primary/[0.035] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1"
              data-testid={`button-share-${c.id}`}
            >
              <span
                className={`inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full text-white ring-4 ring-transparent transition-all duration-200 group-hover:-translate-y-0.5 elev-1 group-hover:elev-2 ${c.disc}`}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-primary/80 leading-tight text-center">
                {c.label}
              </span>
              <span className="hidden sm:block text-[10px] text-primary/45 leading-tight text-center -mt-0.5">
                {c.hint}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Copy link row */}
      <div className="rounded-2xl border border-border/60 bg-white/60 backdrop-blur-sm overflow-hidden">
        <div className="flex items-stretch">
          <div className="flex items-center gap-2 px-3 sm:px-4 flex-1 min-w-0">
            <LinkIcon className="h-3.5 w-3.5 text-primary/40 shrink-0" aria-hidden />
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Devotion link"
              className="flex-1 bg-transparent text-xs sm:text-[13px] text-primary/70 font-mono py-3 outline-none truncate"
              data-testid="input-share-url"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 sm:px-5 inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold transition-colors duration-200 border-l border-border/60 focus-visible:outline-none focus-visible:bg-accent/10 ${
              copied
                ? "bg-emerald-50 text-emerald-700"
                : "bg-primary/[0.03] text-primary hover:bg-primary/10"
            }`}
            aria-label={copied ? "Copied to clipboard" : "Copy link to clipboard"}
            data-testid="button-share-copy"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <LinkIcon className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-4 px-1 text-[11px] text-primary/45 text-center leading-relaxed">
        “Go ye therefore, and teach all nations.” — <em>Matthew 28:19</em>
      </p>
    </div>
  );
}

export default function DevotionShareDialog({
  open,
  onOpenChange,
  devotion,
}: DevotionShareDialogProps) {
  const isMobile = useIsMobile();
  const handleComplete = () => onOpenChange(false);

  // Lock body scroll handled by Dialog/Drawer primitives.
  // We only manage focus restoration via the primitive defaults.
  useEffect(() => {
    if (!open) return;
    // Soft analytics hook — could wire to a tracker here.
  }, [open]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-[#FFFEF8] border-border/60 px-4 pb-6 max-h-[90vh]">
          <DrawerHeader className="px-1 pt-2 pb-4 text-left">
            <DrawerTitle className="font-serif text-xl text-primary leading-tight">
              Share today's devotion
            </DrawerTitle>
            <DrawerDescription className="text-xs text-primary/55 mt-1">
              Choose a way to send this Word to someone you love.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto -mx-1 px-1">
            <ShareBody devotion={devotion} onComplete={handleComplete} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] bg-[#FFFEF8] border-border/60 p-6 sm:p-7"
        data-testid="dialog-share-devotion"
      >
        <DialogHeader className="text-left pr-8">
          <DialogTitle className="font-serif text-2xl text-primary leading-tight tracking-tight">
            Share today's devotion
          </DialogTitle>
          <DialogDescription className="text-sm text-primary/55 mt-1.5">
            Choose a way to send this Word to someone you love.
          </DialogDescription>
        </DialogHeader>
        <ShareBody devotion={devotion} onComplete={handleComplete} />
      </DialogContent>
    </Dialog>
  );
}
