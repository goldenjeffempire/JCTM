import { useState } from "react";
import { MapPin } from "lucide-react";
import { DirectionsModal } from "./DirectionsModal";
import {
  CHURCH_NAME,
  CHURCH_ADDRESS_LINES,
  CHURCH_ADDRESS_SHORT,
} from "../constants/church";

interface Props {
  /** "full" = name + all lines (default), "short" = short inline text, "inline" = single line no name */
  variant?: "full" | "short" | "inline";
  className?: string;
  showIcon?: boolean;
  /** Override the displayed text for the "inline" variant */
  label?: string;
}

export function ChurchAddressBlock({
  variant = "full",
  className = "",
  showIcon = false,
  label,
}: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = () => setOpen(true);

  const baseClass =
    "cursor-pointer group transition-opacity hover:opacity-80 active:opacity-60";

  return (
    <>
      {variant === "inline" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`${baseClass} flex items-center gap-1.5 text-left ${className}`}
          title="Tap for directions"
        >
          {showIcon && <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span className="underline decoration-dotted underline-offset-2">
            {label ?? CHURCH_ADDRESS_SHORT}
          </span>
        </button>
      ) : variant === "short" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`${baseClass} flex items-start gap-2 text-left ${className}`}
          title="Tap for directions"
        >
          {showIcon && <MapPin className="h-4 w-4 shrink-0 mt-0.5" />}
          <span className="underline decoration-dotted underline-offset-2 leading-snug">
            {CHURCH_ADDRESS_SHORT}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`${baseClass} not-italic text-left group ${className}`}
          title="Tap for directions"
        >
          <address className="not-italic space-y-0.5 leading-relaxed">
            <p className="font-semibold group-hover:underline decoration-dotted underline-offset-2">
              {CHURCH_NAME}
            </p>
            {CHURCH_ADDRESS_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </address>
          {showIcon && (
            <span className="inline-flex items-center gap-1 mt-2 text-[11px] text-accent font-medium">
              <MapPin className="h-3 w-3" />
              Tap for directions
            </span>
          )}
        </button>
      )}

      <DirectionsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
