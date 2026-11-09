import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { setOrderStatus } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { FormButton } from '@/components/admin/form-button';

export const metadata: Metadata = { title: 'Tilaukset' };

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  RECEIVED: { label: 'Vastaanotettu', variant: 'warning' },
  PAID: { label: 'Maksettu', variant: 'success' },
  COMPLETED: { label: 'Luovutettu', variant: 'default' },
  CANCELLED: { label: 'Peruutettu', variant: 'secondary' },
};

const STATUSES = ['RECEIVED', 'PAID', 'COMPLETED', 'CANCELLED'] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSuperAdmin();
  const { status: statusParam } = await searchParams;
  const filter = STATUSES.includes(statusParam as (typeof STATUSES)[number])
    ? (statusParam as (typeof STATUSES)[number])
    : undefined;

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const counts = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const totalCount = counts.reduce((sum, c) => sum + c._count._all, 0);

  const total = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tilaukset</h1>
        <div className="text-sm text-muted-foreground">
          Näytetään {orders.length} tilausta · yhteensä {formatCents(total)}
        </div>
      </div>

      {/* Status tabs */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === undefined
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
          }`}
        >
          Kaikki ({totalCount})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
            }`}
          >
            {STATUS_META[s].label} ({countBy[s] || 0})
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei tilauksia tällä suodattimella.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    #{order.id.slice(-8).toUpperCase()}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {format(order.createdAt, 'd.M.yyyy HH:mm', { locale: fi })}
                    </span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {order.name ?? 'Ei nimeä'} {order.email ? `· ${order.email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_META[order.status].variant}>
                    {STATUS_META[order.status].label}
                  </Badge>
                  <span className="font-bold">{formatCents(order.totalCents)}</span>
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Tilauksen tuotteet ({order.lines.reduce((sum, l) => sum + l.quantity, 0)} kpl)
                </summary>
                <ul className="mt-2 space-y-1 rounded-md bg-background p-3 text-sm">
                  {order.lines.map((line) => {
                    const answers = Array.isArray(line.answers)
                      ? (line.answers as {
                          questionId: string;
                          prompt?: string;
                          answer?: string | string[];
                        }[])
                      : [];
                    return (
                      <li key={line.id} className="space-y-1">
                        <div className="flex justify-between gap-3">
                          <span>
                            {line.name} × {line.quantity}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatCents(line.priceCents * line.quantity)}
                          </span>
                        </div>
                        {answers.length > 0 && (
                          <ul className="ml-4 space-y-0.5 text-xs text-muted-foreground">
                            {answers.map((answer) => (
                              <li key={answer.questionId}>
                                {answer.prompt}:{' '}
                                {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>

              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === 'RECEIVED' && (
                  <StatusButton orderId={order.id} status="PAID" label="Merkitse maksetuksi" />
                )}
                {(order.status === 'RECEIVED' || order.status === 'PAID') && (
                  <StatusButton
                    orderId={order.id}
                    status="CANCELLED"
                    label="Peruuta"
                    variant="ghost"
                    confirm={`Peruutetaanko tilaus #${order.id.slice(-8).toUpperCase()}?`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusButton({
  orderId,
  status,
  label,
  variant = 'outline',
  confirm,
}: {
  orderId: string;
  status: string;
  label: string;
  variant?: 'outline' | 'ghost';
  confirm?: string;
}) {
  return (
    <form action={setOrderStatus}>
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={status} />
      <FormButton size="sm" variant={variant} confirm={confirm}>
        {label}
      </FormButton>
    </form>
  );
}
