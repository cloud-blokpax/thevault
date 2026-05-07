"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallbackText?: string;
  /** Optional explicit hi-res override. */
  hiResSrc?: string | null;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function deriveHiResSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.includes("_in_1000x1000")) {
    return src.replace("_in_1000x1000", "_in_2000x2000");
  }
  return src;
}

export function ZoomableCardImage({
  src,
  alt,
  width,
  height,
  className,
  fallbackText,
  hiResSrc,
}: Props) {
  const [open, setOpen] = useState(false);
  const fullSrc = hiResSrc ?? deriveHiResSrc(src);

  if (!src) {
    return (
      <CardImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        fallbackText={fallbackText}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Zoom ${alt}`}
        className={cn(
          "block cursor-zoom-in rounded transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className,
        )}
      >
        <CardImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          fallbackText={fallbackText}
        />
      </button>
      <Lightbox
        open={open}
        onOpenChange={setOpen}
        src={fullSrc ?? src}
        alt={alt}
      />
    </>
  );
}

function Lightbox({
  open,
  onOpenChange,
  src,
  alt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  src: string;
  alt: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const draggingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setTx(0);
      setTy(0);
    }
  }, [open]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta * z));
      if (next === MIN_ZOOM) {
        setTx(0);
        setTy(0);
      }
      return next;
    });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !lastPointRef.current) return;
    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    setTx((v) => v + dx);
    setTy((v) => v + dy);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    lastPointRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.dist;
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, pinchRef.current.zoom * ratio),
      );
      setZoom(next);
      if (next === MIN_ZOOM) {
        setTx(0);
        setTy(0);
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
  }

  function reset() {
    setZoom(1);
    setTx(0);
    setTy(0);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 focus:outline-none"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Zoomed card image. Use mouse wheel or pinch to zoom, click and drag
            to pan, press Escape to close.
          </Dialog.Description>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))
              }
              className="rounded px-2 py-0.5 hover:bg-white/10"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
              className="rounded px-2 py-0.5 hover:bg-white/10"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={reset}
              className="ml-1 rounded px-2 py-0.5 hover:bg-white/10"
            >
              Reset
            </button>
          </div>
          <div
            className="flex max-h-[80vh] max-w-[80vw] items-center justify-center overflow-hidden"
            style={{
              cursor:
                zoom > 1
                  ? draggingRef.current
                    ? "grabbing"
                    : "grab"
                  : "zoom-in",
            }}
            onClick={(e) => {
              if (zoom === 1 && e.target === e.currentTarget) {
                onOpenChange(false);
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="max-h-[80vh] max-w-[80vw] select-none object-contain"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
                transition: draggingRef.current ? "none" : "transform 80ms",
                touchAction: "none",
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
