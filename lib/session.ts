import { cache } from 'react';
import { auth } from '@/lib/auth';

/** Reuse the session lookup when a request needs it in both the layout and page. */
export const getSession = cache(() => auth());
