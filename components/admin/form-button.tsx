'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { LoadingPill } from '@/components/ui/loading-pill';

/**
 * Submit button for a server-action <form>. Shows a skeleton pill while the action is
 * in flight (so a click gives immediate feedback). With `confirm`, it asks
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
      {pending ? <LoadingPill className="bg-current/25" /> : children}
    </Button>
  );
}
