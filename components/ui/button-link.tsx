import Link from 'next/link';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * A Next.js <Link> that looks like a <Button>. Use this instead of wrapping a
 * <Button> in a <Link>. That renders a <button> inside an <a>, which is
 * invalid HTML and breaks keyboard focus.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
