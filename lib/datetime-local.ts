/**
 * Pass A2 (item 5a) — timezone-aware timestamps for the notifications page.
 * Shows the viewer's local date and time with the zone abbreviation (for
 * example "5 Oct 2026, 14:32 EAT"); the exact ISO instant is available
 * separately, for a hover title, so nothing is ambiguous across zones.
 */
export function formatLocalDateTime(iso: string): { display: string; isoTitle: string; zone: string } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { display: iso, isoTitle: iso, zone: '' }
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  const parts = formatter.formatToParts(date)
  const zone = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  return { display: formatter.format(date), isoTitle: date.toISOString(), zone }
}
