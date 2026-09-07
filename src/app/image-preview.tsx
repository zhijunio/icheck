"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ImagePreviewProps = {
  src: string;
  alt: string;
  className?: string;
  buttonClassName?: string;
  width?: number;
  height?: number;
  sizes?: string;
  fill?: boolean;
  unoptimized?: boolean;
};

export function ImagePreview({ src, alt, className, buttonClassName, width = 64, height = 64, sizes, fill = false, unoptimized = false }: ImagePreviewProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button aria-label={`放大查看${alt}`} className={buttonClassName ?? "inline-flex cursor-zoom-in"} onClick={() => setOpen(true)} type="button">
      {fill ? <Image alt={alt} className={className} fill sizes={sizes} src={src} unoptimized={unoptimized} /> : <Image alt={alt} className={className} height={height} sizes={sizes} src={src} unoptimized={unoptimized} width={width} />}
    </button>
    {open && <div aria-label={`${alt}原图`} aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4" onClick={() => setOpen(false)} role="dialog">
      <button aria-label="关闭原图预览" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/25" onClick={() => setOpen(false)} type="button">×</button>
      <div className="flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <Image alt={alt} className="max-h-[92vh] w-auto max-w-[92vw] object-contain" height={1600} src={src} unoptimized width={1600} />
      </div>
    </div>}
  </>;
}
