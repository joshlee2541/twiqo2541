import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cropper as CropperIcon, X } from "lucide-react";

const VIEW = 256; // circular viewport size in CSS px
const OUT = 512; // exported square size in px

interface Props {
  file: File;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

/**
 * Circular avatar cropper: drag to reposition, slider/wheel/pinch-free zoom.
 * Exports a 512x512 JPEG File ready for upload.
 */
export function AvatarCropper({ file, onCancel, onCropped }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [base, setBase] = useState(1); // scale where the image covers the viewport
  const [zoom, setZoom] = useState(1); // multiplier over base
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const b = Math.max(VIEW / im.naturalWidth, VIEW / im.naturalHeight);
      setBase(b);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImg(im);
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clampOffset = useCallback(
    (off: { x: number; y: number }, z: number) => {
      if (!img) return off;
      const s = base * z;
      const maxX = Math.max(0, (img.naturalWidth * s - VIEW) / 2);
      const maxY = Math.max(0, (img.naturalHeight * s - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, off.x)),
        y: Math.min(maxY, Math.max(-maxY, off.y)),
      };
    },
    [img, base],
  );

  const setZoomClamped = useCallback(
    (z: number) => {
      const next = Math.min(4, Math.max(1, z));
      setZoom(next);
      setOffset((o) => clampOffset(o, next));
    },
    [clampOffset],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clampOffset({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, zoom));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoomClamped(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  };

  const crop = () => {
    if (!img) return;
    const s = base * zoom;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const left = VIEW / 2 - dw / 2 + offset.x;
    const top = VIEW / 2 - dh / 2 + offset.y;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -left / s, -top / s, VIEW / s, VIEW / s, 0, 0, OUT, OUT);
    // Small preview dataURL so the draft survives page refreshes.
    const prev = document.createElement("canvas");
    prev.width = 160;
    prev.height = 160;
    prev.getContext("2d")?.drawImage(canvas, 0, 0, 160, 160);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const out = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        (out as File & { previewDataUrl?: string }).previewDataUrl = prev.toDataURL("image/jpeg", 0.8);
        onCropped(out);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative h-64 w-64 overflow-hidden rounded-full border-2 border-border touch-none select-none cursor-grab active:cursor-grabbing"
      >
        {img && (
          <img
            src={img.src}
            alt="Crop preview"
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              width: img.naturalWidth * base * zoom,
              height: img.naturalHeight * base * zoom,
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
        <div className="absolute inset-0 rounded-full ring-2 ring-background/60 pointer-events-none" />
      </div>

      <div className="flex items-center gap-3 w-full max-w-xs px-2">
        <CropperIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoomClamped(Number(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
      </div>
      <p className="text-xs text-muted-foreground">Drag to reposition · scroll or slider to zoom</p>

      <div className="flex gap-2 w-full max-w-xs">
        <Button variant="secondary" className="flex-1 rounded-full" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button className="flex-1 rounded-full" disabled={!img} onClick={crop}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
