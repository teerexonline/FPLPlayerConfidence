import 'server-only';
import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api/watchlist');

export function GET(): NextResponse {
  const { watchlist } = getRepositories();
  const ids = watchlist.findByUser(SYSTEM_USER_ID);
  logger.info('GET watchlist', { count: ids.length });
  return NextResponse.json({ ids });
}

export async function POST(request: Request): Promise<NextResponse> {
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
  watchlist.add(SYSTEM_USER_ID, playerId);
  logger.info('POST watchlist: added', { playerId });
  return NextResponse.json({ ok: true });
}
