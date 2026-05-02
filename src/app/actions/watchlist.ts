'use server';

import { revalidatePath } from 'next/cache';

/** Invalidates the dashboard route cache after any watchlist mutation. */
// eslint-disable-next-line @typescript-eslint/require-await -- server actions must be async
export async function revalidateWatchlistCache(): Promise<void> {
  revalidatePath('/');
}
