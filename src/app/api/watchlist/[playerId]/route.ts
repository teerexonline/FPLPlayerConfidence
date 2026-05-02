import 'server-only';
import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api/watchlist/[playerId]');

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playerId: string }> },
): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playerId } = await params;
  const id = parseInt(playerId, 10);
  if (isNaN(id)) {
    logger.warn('DELETE watchlist: invalid playerId', { playerId });
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }
  const { watchlist } = getRepositories();
  await watchlist.removeForAuthUser(user.id, id);
  logger.info('DELETE watchlist: removed', { playerId: id });
  return NextResponse.json({ ok: true });
}
