'use client';

import { useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Copy the attendee emails as a comma-separated list, or open a mail draft with
 * everyone in BCC. Copy is the reliable path (no length limit); the mailto link
 * is a convenience that some clients cap for very large lists.
 */
export function RegistrantEmails({ emails, subject }: { emails: string[]; subject: string }) {
  const [copied, setCopied] = useState(false);
  const list = emails.join(', ');
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&bcc=${encodeURIComponent(
    emails.join(','),
  )}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the textarea below is the
      // fallback: the list is selectable there.
    }
  }

  if (emails.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? 'Kopioitu!' : `Kopioi sähköpostit (${emails.length})`}
        </Button>
        <a href={mailto}>
          <Button type="button" size="sm" variant="outline">
            <Mail /> Lähetä sähköposti (BCC)
          </Button>
        </a>
      </div>
      <textarea
        readOnly
        value={list}
        onFocus={(e) => e.currentTarget.select()}
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
      />
    </div>
  );
}
