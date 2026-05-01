import 'server-only';
import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api/watchlist/[playerId]');

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playerId: string }> },
): Promise<NextResponse> {
  const { playerId } = await params;
  const id = parseInt(playerId, 10);
  if (isNaN(id)) {
    logger.warn('DELETE watchlist: invalid playerId', { playerId });
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }
  const { watchlist } = getRepositories();
  await watchlist.remove(SYSTEM_USER_ID, id);
  logger.info('DELETE watchlist: removed', { playerId: id });
  return NextResponse.json({ ok: true });
}
