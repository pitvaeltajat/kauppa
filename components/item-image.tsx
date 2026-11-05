import Image from 'next/image';
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
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 100vw"
          className="object-cover"
        />
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
