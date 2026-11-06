'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Submit button for a server-action <form>. Shows a spinner while the action is
 * in flight (so a click gives immediate feedback), and — with `confirm` — asks
 * before firing, so a destructive action isn't one stray tap away.
 */
export function FormButton({
  confirm,
  children,
  disabled,
  ...props
}: ButtonProps & { confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      {...props}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
