import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CategoryForm } from '@/components/admin/category-form';

export const metadata: Metadata = { title: 'Uusi kategoria' };

export default function NewCategoryPage() {
  return (
    <div>
      <Link
        href="/admin/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Kategoriat
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Uusi kategoria</h1>
      <CategoryForm />
    </div>
  );
}
