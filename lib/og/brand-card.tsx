export const OG_IMAGE_SIZE = { width: 1200, height: 630 }

export function BrandCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        backgroundColor: '#0A1A20',
        backgroundImage:
          'linear-gradient(135deg, #0A1A20 0%, #0C3B33 55%, #0F5A4A 100%)',
        position: 'relative',
      }}
    >
      {/* Decorative pulse-line motif, echoing the in-app auth screens */}
      <svg
        width="1200"
        height="260"
        viewBox="0 0 1200 260"
        style={{ position: 'absolute', top: 190, left: 0, opacity: 0.18 }}
      >
        <path
          d="M 0,150 Q 200,90 400,150 T 800,150 T 1200,150"
          stroke="#14B8A6"
          strokeWidth="4"
          fill="none"
        />
      </svg>

      {/* Logo mark + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 24,
            backgroundColor: '#14B8A6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 64 64">
            <polyline
              points="8,32 16,32 20,16 24,48 28,32 36,32 48,32 56,32"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, color: '#F5F9F7', display: 'flex' }}>
          SafeMeds
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 36,
          fontSize: 34,
          color: '#9FD8CC',
          display: 'flex',
          maxWidth: 900,
        }}
      >
        The Pharmaceutical Compliance Standard
      </div>

      {/* Eyebrow */}
      <div
        style={{
          marginTop: 52,
          fontSize: 21,
          letterSpacing: 5,
          color: '#5FBFAA',
          textTransform: 'uppercase',
          display: 'flex',
        }}
      >
        Security · Compliance · Traceability
      </div>
    </div>
  )
}
