'use client';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import { fi } from 'date-fns/locale/fi';
import { useState } from 'react';
import { Label } from '@/components/ui/label';

registerLocale('fi', fi);

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(value: Date | null): string {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function EventDateFields({
  startsAt,
  endsAt,
}: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  const [start, setStart] = useState<Date | null>(() => parseDate(startsAt));
  const [end, setEnd] = useState<Date | null>(() => parseDate(endsAt));

  function onStartChange(value: Date | null) {
    setStart(value);
    if (value && end && end < value) setEnd(value);
  }

  function onEndChange(value: Date | null) {
    setEnd(value);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="startsAt">Alkaa *</Label>
        <DatePicker
          id="startsAt"
          selected={start}
          onChange={onStartChange}
          locale="fi"
          dateFormat="dd.MM.yyyy"
          placeholderText="pp.kk.vvvv"
          required
          autoComplete="off"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input type="hidden" name="startsAt" value={formatDate(start)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Päättyy *</Label>
        <DatePicker
          id="endsAt"
          selected={end}
          onChange={onEndChange}
          minDate={start ?? undefined}
          locale="fi"
          dateFormat="dd.MM.yyyy"
          placeholderText="pp.kk.vvvv"
          required
          autoComplete="off"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input type="hidden" name="endsAt" value={formatDate(end)} />
      </div>
    </div>
  );
}
