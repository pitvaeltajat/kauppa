import { ImageResponse } from 'next/og';

export const alt = 'Kontti · Pitkäjärven Vaeltajat';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: '#f4f6ff',
        color: '#221e5d',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        padding: '80px',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3 }}>PITKÄJÄRVEN VAELTAJAT</div>
      <div style={{ fontSize: 76, fontWeight: 800, marginTop: 24 }}>Kontti</div>
      <div style={{ color: '#555574', fontSize: 34, marginTop: 18 }}>
        Nettikauppa ja tapahtumailmoittautumiset
      </div>
      <div
        style={{ background: '#221e5d', borderRadius: 24, height: 18, marginTop: 56, width: 180 }}
      />
    </div>,
    { ...size },
  );
}
