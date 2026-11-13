import { useCallback, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { clampCrop, type CropArea } from "./photo-utils";

interface Props {
  src: string;
  imageWidth: number;
  imageHeight: number;
  initialCrop?: CropArea;
  onApply: (crop: CropArea) => void;
  onCancel: () => void;
}

/** Inline square cropper (rounded-frame card). Produces a source-pixel crop; the canvas draws the real photo from it. */
export function PhotoCropper({ src, imageWidth, imageHeight, initialCrop, onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  return (
    <div className="relative z-[60] rounded-2xl border border-[#ffc93c]/40 bg-[#050c26] overflow-hidden" role="group" aria-label="Adjust your photo" data-testid="panel-photo-cropper">
      <div className="relative w-full h-[min(60vw,320px)] bg-black/40">
        <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="rect" showGrid={false} minZoom={1} maxZoom={4}
          initialCroppedAreaPixels={initialCrop}
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete}
          style={{ cropAreaStyle: { border: "3px solid #38bdf8", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(5,12,38,0.72)" } }} />
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-white/60 text-center">Drag to reposition. Pinch, scroll or use the slider to zoom.</p>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(1, +(z - 0.2).toFixed(2)))} className="h-11 w-11 shrink-0 rounded-full border border-white/20 text-white inline-flex items-center justify-center hover:bg-white/10"><ZoomOut className="h-4 w-4" /></button>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))}
            aria-label="Zoom" className="flex-1 accent-[#ffc93c]" data-testid="input-photo-zoom" />
          <button type="button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(2)))} className="h-11 w-11 shrink-0 rounded-full border border-white/20 text-white inline-flex items-center justify-center hover:bg-white/10"><ZoomIn className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="h-11 rounded-full border border-white/25 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/10" data-testid="button-crop-cancel">
            <X className="h-4 w-4" /> Cancel
          </button>
          <button type="button" disabled={!area} onClick={() => area && onApply(clampCrop(area, imageWidth, imageHeight))}
            className="h-11 rounded-full bg-[#ffc93c] text-[#071130] font-black inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="button-crop-apply">
            <Check className="h-4 w-4" /> Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}
