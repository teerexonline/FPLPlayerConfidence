import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: '#1E40AF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: -0.5,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      FC
    </div>,
    size,
  );
}
