'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginForm({
  devEnabled,
  callbackUrl,
}: {
  devEnabled: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function googleSignIn() {
    setLoading(true);
    await signIn('google', { callbackUrl });
    // signIn redirects; no setLoading(false) needed on success.
  }

  async function devSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn('dev-login', { email, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError('Kirjautuminen epäonnistui. Tarkista sähköpostiosoite.');
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Kirjaudu sisään</CardTitle>
        <CardDescription>
          Hallintatyökalut ovat PitVa-väelle. Kirjaudu Google-tilillä (PitVa-sähköposti).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" variant="secondary" onClick={googleSignIn} disabled={loading}>
          Jatka Google-tilillä
        </Button>

        {devEnabled && (
          <form onSubmit={devSignIn} className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Kehitystila: kirjaudu sisään sähköpostilla ilman salasanaa.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dev-email">Sähköposti</Label>
              <Input
                id="dev-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="etunimi@example.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !email.includes('@')}>
              Kirjaudu (kehitys)
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
