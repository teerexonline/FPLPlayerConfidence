import 'server-only';
import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api/watchlist');

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous users always get an empty watchlist — no error, just empty.
  if (!user) return NextResponse.json({ ids: [] });

  const { watchlist } = getRepositories();
  const ids = await watchlist.findByAuthUser(user.id);
  logger.info('GET watchlist', { count: ids.length });
  return NextResponse.json({ ids });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as unknown;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('playerId' in body) ||
    typeof (body as Record<string, unknown>)['playerId'] !== 'number'
  ) {
    logger.warn('POST watchlist: invalid body');
    return NextResponse.json(
      { error: 'Invalid body: playerId (number) required' },
      { status: 400 },
    );
  }
  const playerId = (body as { playerId: number }).playerId;
  const { watchlist } = getRepositories();
  await watchlist.addForAuthUser(user.id, playerId);
  logger.info('POST watchlist: added', { playerId });
  return NextResponse.json({ ok: true });
}
