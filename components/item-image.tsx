'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Product image with a neutral "Ei kuvaa" placeholder when the item has none. */
export function ItemImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src) {
    const loaded = loadedSrc === src;
    const failed = failedSrc === src;
    return (
      <div
        className={cn('relative aspect-square w-full overflow-hidden rounded-md bg-muted', className)}
        aria-busy={!loaded && !failed}
      >
        {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />}
        {failed ? (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground" aria-label={alt}>
            Ei kuvaa
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Item image URLs can come from S3 or migrated assets.
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
          />
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex aspect-square w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground',
        className,
      )}
      aria-label={alt}
    >
      Ei kuvaa
    </div>
  );
}
