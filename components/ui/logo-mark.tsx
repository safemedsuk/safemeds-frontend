'use client'

export interface LogoMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
}

export function LogoMark({ size = 'md', className }: LogoMarkProps) {
  const pixels = sizeMap[size]

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg bg-[var(--primary)] ${className}`}
      style={{ width: pixels, height: pixels }}
      role="img"
      aria-label="SafeMeds"
    >
      {/* Pulse/heartbeat line SVG */}
      <svg
        viewBox="0 0 64 64"
        width={pixels * 0.65}
        height={pixels * 0.65}
        className="text-white"
      >
        <polyline
          points="8,32 16,32 20,16 24,48 28,32 36,32 48,32 56,32"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size="md" />
      <span className="font-display font-700 text-lg text-[var(--text)]">
        SafeMeds
      </span>
    </div>
  )
}
