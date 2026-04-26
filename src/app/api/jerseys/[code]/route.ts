import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';

// Confirmed working path per docs/API.md §4.2 — all three canonical codes return 200.
const CDN_BASE = 'https://fantasy.premierleague.com/dist/img/shirts/standard';
const CACHE_DIR = join(process.cwd(), 'public', 'jerseys');

function makeSvgFallback(code: string): string {
  const hue = (parseInt(code, 10) * 37) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 66" width="66" height="66">
    <rect width="66" height="66" rx="6" fill="hsl(${hue.toString()},55%,42%)"/>
    <text x="33" y="37" font-family="system-ui,sans-serif" font-size="20" font-weight="700"
          fill="white" text-anchor="middle" dominant-baseline="middle">${code}</text>
  </svg>`;
}

const ALLOWED_SIZES = new Set(['66', '110']);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const size = req.nextUrl.searchParams.get('size') ?? '66';

  if (!/^\d{1,4}$/.test(code)) {
    return new NextResponse('Invalid team code', { status: 400 });
  }
  if (!ALLOWED_SIZES.has(size)) {
    return new NextResponse('Invalid size — use 66 or 110', { status: 400 });
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `shirt_${code}-${size}.png`);

  if (existsSync(cachePath)) {
    return new NextResponse(readFileSync(cachePath), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  }

  try {
    const res = await fetch(`${CDN_BASE}/shirt_${code}-${size}.png`);
    if (!res.ok) throw new Error(`CDN ${res.status.toString()}`);

    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(cachePath, buf);

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse(makeSvgFallback(code), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
