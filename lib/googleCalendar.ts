import { getGoogleAccessToken } from '@/lib/googleAuth';
import { toISODate, type DateRange } from '@/lib/kammi';

/**
 * Read/write the kammi (cabin) Google Calendar — the master record of what is
 * booked. Authenticates with the same service account as the Workspace sync
 * (`lib/googleAuth`), impersonating the calendar's owner so it can both read
 * busy days and write a confirmed booking back.
 *
 * Config (all optional — unset = disabled, and the app falls back to its own
 * bookings as the only availability source, logging a warning):
 *   KAMMI_CALENDAR_ID       the calendar to read/write (owned by admin@pitva.fi)
 *   KAMMI_CALENDAR_SUBJECT  a user to impersonate who can edit it (default admin@pitva.fi)
 *
 * The service account's domain-wide delegation must include the Calendar scope
 * below (added in Admin console → Security → API controls → Domain-wide
 * delegation, same place the directory scopes live).
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export function kammiCalendarConfigured(): boolean {
  return !!process.env.KAMMI_CALENDAR_ID;
}

function calendarId(): string {
  const id = process.env.KAMMI_CALENDAR_ID;
  if (!id) throw new Error('KAMMI_CALENDAR_ID is not set');
  return id;
}

function subject(): string {
  return process.env.KAMMI_CALENDAR_SUBJECT || 'admin@pitva.fi';
}

async function token(): Promise<string> {
  return getGoogleAccessToken(SCOPES, subject());
}

type GoogleEvent = {
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

/** The date part of an event endpoint (all-day `date` or timed `dateTime`). */
function endpointDate(point: { date?: string; dateTime?: string } | undefined): string | null {
  if (!point) return null;
  if (point.date) return point.date;
  if (point.dateTime) return toISODate(new Date(point.dateTime));
  return null;
}

/**
 * Busy ranges on the kammi calendar between two ISO dates. Returns [] (and logs)
 * when the calendar isn't configured or the read fails — availability then rests
 * on kauppa's own bookings alone, which is safe (it can only over-report free
 * days to the extent the calendar isn't reachable, and the DB still blocks a
 * real double-book at payment time).
 */
export async function fetchKammiBusyRanges(fromISO: string, toISO: string): Promise<DateRange[]> {
  if (!kammiCalendarConfigured()) return [];
  try {
    const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events`);
    url.searchParams.set('timeMin', `${fromISO}T00:00:00Z`);
    url.searchParams.set('timeMax', `${toISO}T00:00:00Z`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '2500');

    const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!res.ok) throw new Error(`Calendar list failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { items?: GoogleEvent[] };

    const ranges: DateRange[] = [];
    for (const event of data.items ?? []) {
      if (event.status === 'cancelled') continue;
      const start = endpointDate(event.start);
      let end = endpointDate(event.end);
      if (!start) continue;
      // A timed or zero-length event still blocks its own day.
      if (!end || end <= start) end = toISODate(new Date(new Date(`${start}T00:00:00Z`).getTime() + 86_400_000));
      ranges.push({ start, end });
    }
    return ranges;
  } catch (error) {
    console.error('Kammi calendar read failed, falling back to DB bookings only:', error);
    return [];
  }
}

/**
 * Write a confirmed booking to the calendar as an all-day event. Returns the
 * event id, or null if the calendar isn't configured / the write failed (the
 * booking is still confirmed and the keycode still sent — the calendar entry is
 * a convenience, re-addable by hand).
 */
export async function createKammiEvent(input: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
}): Promise<string | null> {
  if (!kammiCalendarConfigured()) return null;
  try {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { date: input.startISO },
          end: { date: input.endISO },
        }),
      },
    );
    if (!res.ok) throw new Error(`Calendar insert failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch (error) {
    console.error('Kammi calendar write failed (booking still confirmed):', error);
    return null;
  }
}

/** Remove the calendar event for a cancelled booking. Best-effort. */
export async function deleteKammiEvent(eventId: string): Promise<void> {
  if (!kammiCalendarConfigured() || !eventId) return;
  try {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` } },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Calendar delete failed (${res.status}): ${await res.text()}`);
    }
  } catch (error) {
    console.error('Kammi calendar delete failed:', error);
  }
}
