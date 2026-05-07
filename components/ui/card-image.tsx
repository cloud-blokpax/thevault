"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallbackText?: string;
};

export function CardImage({ src, alt, width, height, className, fallbackText = "no image" }: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        aria-hidden={!fallbackText}
        className={cn(
          "flex shrink-0 items-center justify-center rounded border bg-muted text-[10px] uppercase tracking-wide text-muted-foreground",
          className,
        )}
        style={{ width, height }}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn("shrink-0 rounded border bg-muted object-contain", className)}
      style={{ width, height }}
    />
  );
}
