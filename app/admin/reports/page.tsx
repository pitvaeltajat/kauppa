import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { requireSuperAdmin } from '@/lib/admin-guard';

export const metadata: Metadata = { title: 'Myyntiraportti' };

// Sales come from our own database, the source of truth for what was sold.
// A sale is an order that was actually paid (PAID) or handed over (COMPLETED);
// RECEIVED (awaiting payment) and CANCELLED do not count. The period filters on
// the order date (createdAt), since paidAt is not set on every path.
const PERIODS = ['all', 'month', 'year', 'prev-year'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  all: 'Kaikki',
  month: 'Kuluva kuukausi',
  year: 'Kuluva vuosi',
  'prev-year': 'Edellinen vuosi',
};

function periodWindow(period: Period): { gte?: Date; lt?: Date } {
  const now = new Date();
  switch (period) {
    case 'month':
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'year':
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case 'prev-year':
      return {
        gte: new Date(now.getFullYear() - 1, 0, 1),
        lt: new Date(now.getFullYear(), 0, 1),
      };
    case 'all':
    default:
      return {};
  }
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireSuperAdmin();
  const { period: periodParam } = await searchParams;
  const period: Period = PERIODS.includes(periodParam as Period) ? (periodParam as Period) : 'all';
  const window = periodWindow(period);

  const lines = await prisma.orderLine.findMany({
    where: {
      order: {
        status: { in: ['PAID', 'COMPLETED'] },
        ...(window.gte || window.lt ? { createdAt: window } : {}),
      },
    },
    select: {
      orderId: true,
      itemId: true,
      name: true,
      priceCents: true,
      quantity: true,
      item: { select: { category: { select: { name: true } } } },
    },
  });

  // Aggregate in JS: line revenue is priceCents × quantity, which the DB cannot
  // sum directly. The data volume (a troop store) makes this trivial.
  const orderIds = new Set<string>();
  let revenueCents = 0;
  let unitsSold = 0;
  const byItem = new Map<string, { name: string; units: number; revenueCents: number }>();
  const byCategory = new Map<string, { units: number; revenueCents: number }>();

  for (const line of lines) {
    const lineRevenue = line.priceCents * line.quantity;
    orderIds.add(line.orderId);
    revenueCents += lineRevenue;
    unitsSold += line.quantity;

    const item = byItem.get(line.itemId) ?? { name: line.name, units: 0, revenueCents: 0 };
    item.units += line.quantity;
    item.revenueCents += lineRevenue;
    byItem.set(line.itemId, item);

    const categoryName = line.item?.category?.name ?? 'Muu';
    const cat = byCategory.get(categoryName) ?? { units: 0, revenueCents: 0 };
    cat.units += line.quantity;
    cat.revenueCents += lineRevenue;
    byCategory.set(categoryName, cat);
  }

  const items = [...byItem.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  const categories = [...byCategory.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Myyntiraportti</h1>
        <div className="text-sm text-muted-foreground">Maksetut ja luovutetut tilaukset</div>
      </div>

      {/* Period tabs */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === 'all' ? '/admin/reports' : `/admin/reports?period=${p}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              period === p
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
            }`}
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>

      {/* Summary tiles */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Myynti yhteensä" value={formatCents(revenueCents)} />
        <SummaryTile label="Tilauksia" value={String(orderIds.size)} />
        <SummaryTile label="Myytyjä tuotteita" value={`${unitsSold} kpl`} />
      </div>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei myyntiä tällä aikavälillä.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <ReportTable
            title="Myynti kategorioittain"
            rows={categories.map((c) => ({ key: c.name, label: c.name, units: c.units, revenueCents: c.revenueCents }))}
          />
          <ReportTable
            title="Myynti tuotteittain"
            rows={items.map((i) => ({ key: i.name, label: i.name, units: i.units, revenueCents: i.revenueCents }))}
          />
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; units: number; revenueCents: number }[];
}) {
  return (
    <div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-background text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Nimi</th>
              <th className="px-4 py-2 text-right font-medium">Kpl</th>
              <th className="px-4 py-2 text-right font-medium">Myynti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{row.units}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCents(row.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
