import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

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
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      FC
    </div>,
    size,
  );
}
