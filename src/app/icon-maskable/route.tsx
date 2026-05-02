import { ImageResponse } from 'next/og';

// Maskable icon: 512×512 with "FC" occupying the inner 80% safe zone.
// The outer 10% on each side (≈51px) is solid #1E40AF bleed — Android's
// adaptive icon system can crop any shape up to the safe-zone boundary.
// Smaller font than the /icon/512 variant keeps text well within safe zone.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 512,
        height: 512,
        background: '#1E40AF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 174,
        fontWeight: 800,
        letterSpacing: -6,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      FC
    </div>,
    { width: 512, height: 512 },
  );
}
