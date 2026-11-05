import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminEmail, isDevLoginEnabled } from '@/lib/admin';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = { title: 'Kirjaudu sisään' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : '/admin';

  const session = await auth();
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    redirect(safeCallback);
  }

  return (
    <div className="container flex justify-center py-12">
      <LoginForm devEnabled={isDevLoginEnabled()} callbackUrl={safeCallback} />
    </div>
  );
}
