import { afterEach, describe, expect, it, vi } from 'vitest';

// getGoogleAccessToken does its own network call; stub it so the test exercises
// only the resolver's own logic (the 404 fallback and primaryEmail extraction).
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAccessToken: async () => 'token',
  requireEnv: () => 'subject@pitkajarvenvaeltajat.fi',
}));

import { resolveToPrimaryEmail } from '@/lib/googleWorkspace';

afterEach(() => vi.restoreAllMocks());

const mockFetch = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })),
  );

describe('resolveToPrimaryEmail', () => {
  it('maps an alias to the account primary', async () => {
    mockFetch(200, { primaryEmail: 'Eero.Sahlberg@pitkajarvenvaeltajat.fi' });
    expect(await resolveToPrimaryEmail('eero@pitkajarvenvaeltajat.fi')).toBe(
      'eero.sahlberg@pitkajarvenvaeltajat.fi',
    );
  });

  it('falls back to the input when the address is not a directory user', async () => {
    mockFetch(404, {});
    expect(await resolveToPrimaryEmail('Someone@Example.com')).toBe('someone@example.com');
  });
});
