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
  if (src) {
    return (
      <div className={cn('relative aspect-square w-full overflow-hidden rounded-md bg-muted', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Item image URLs include external Kuvat.fi assets. */}
        <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" />
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
