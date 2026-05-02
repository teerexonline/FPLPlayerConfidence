import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// No border-radius — iOS applies its own squircle mask to the PNG.
// Solid #1E40AF to all four edges so the mask crop never reveals transparency.
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: '#1E40AF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 76,
        fontWeight: 800,
        letterSpacing: -3,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      FC
    </div>,
    size,
  );
}
