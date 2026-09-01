'use client'

/**
 * SafeMeds is Kenya-first, pan-African — a genuine differentiator most
 * compliance SaaS products in this space can't claim. Rather than a
 * hand-drawn continent outline (real cartographic risk of looking wrong
 * to the exact audience this is meant to represent), this renders the
 * platform's actual configured markets as a radial network: Kenya at
 * the center (flagship, "Kenya-first"), the 7 other seeded countries
 * orbiting it, connected by pulse-line motifs matching the existing
 * SafeMeds brand mark's own pulse/heartbeat visual language.
 */

const ORBIT_MARKETS = [
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GH', name: 'Ghana' },
]

const CENTER = 200
const ORBIT_RADIUS = 148

function orbitPosition(index: number, total: number) {
  // Start at the top (-90deg) and go clockwise, so the arrangement reads top-down naturally.
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return {
    x: CENTER + ORBIT_RADIUS * Math.cos(angle),
    y: CENTER + ORBIT_RADIUS * Math.sin(angle),
  }
}

export function PanAfricanNetwork() {
  return (
    <div className="relative w-full flex flex-col items-center">
      <svg viewBox="0 0 400 400" className="w-full max-w-[400px] h-auto" role="img" aria-label="SafeMeds' regulatory network across Kenya, Uganda, Tanzania, Rwanda, Ethiopia, Nigeria, South Africa, and Ghana">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--safemeds-teal)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--safemeds-teal)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={90} fill="url(#centerGlow)" />

        {ORBIT_MARKETS.map((market, i) => {
          const pos = orbitPosition(i, ORBIT_MARKETS.length)
          const pathId = `pulse-path-${market.code}`
          return (
            <g key={market.code}>
              <path
                id={pathId}
                d={`M ${CENTER} ${CENTER} L ${pos.x} ${pos.y}`}
                stroke="var(--safemeds-teal)"
                strokeOpacity={0.22}
                strokeWidth={1.5}
                fill="none"
              />
              <circle r={2.4} fill="var(--safemeds-teal)" opacity={0.9}>
                <animateMotion dur={`${3.2 + i * 0.35}s`} repeatCount="indefinite" begin={`${i * 0.4}s`}>
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </circle>
            </g>
          )
        })}

        {ORBIT_MARKETS.map((market, i) => {
          const pos = orbitPosition(i, ORBIT_MARKETS.length)
          const labelAbove = pos.y < CENTER - 20
          const labelBelow = pos.y > CENTER + 20
          const labelY = labelAbove ? pos.y - 14 : labelBelow ? pos.y + 22 : pos.y + 4
          return (
            <g key={`node-${market.code}`}>
              <circle cx={pos.x} cy={pos.y} r={5} fill="var(--paper)" stroke="var(--safemeds-teal)" strokeWidth={2} />
              <text
                x={pos.x}
                y={labelY}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-mono, monospace)"
                fill="var(--safemeds-teal)"
                opacity={0.85}
              >
                {market.code}
              </text>
            </g>
          )
        })}

        {/* Kenya — flagship, larger, centered */}
        <circle cx={CENTER} cy={CENTER} r={13} fill="var(--safemeds-teal)">
          <animate attributeName="r" values="13;15;13" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={CENTER} cy={CENTER} r={13} fill="none" stroke="var(--safemeds-teal)" strokeOpacity={0.5} strokeWidth={1}>
          <animate attributeName="r" values="13;28;13" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <text x={CENTER} y={CENTER + 32} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--paper)">
          KENYA
        </text>
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-paper/70 font-mono">
        {ORBIT_MARKETS.map((m) => (
          <div key={m.code} className="flex items-center gap-1.5">
            <span className="text-safemeds-teal">{m.code}</span>
            <span>{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
