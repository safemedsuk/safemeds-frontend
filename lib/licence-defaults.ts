/**
 * Shared default-expiry helpers for RegCloud's three licence-shaped
 * records (GMP certificates, facility/premises licences, personnel
 * licences) — a real-usage request asked for a sensible default expiry
 * date on creation, never a forced value (every one of these fields
 * stays fully editable; this only pre-fills the form's initial state).
 *
 * Interpretation decisions (the request was ambiguous on the exact
 * duration for the latter two):
 * - **GMP licensing**: defaults to `issuedOn + 3 years` — the middle of
 *   WHO GMP's own commonly-cited 2–3-year re-inspection/certificate-
 *   validity band (see `Company`'s own schema doc comment, which
 *   already cites this exact band for a related GMP concept).
 * - **Facility & personnel licensing**: Kenya's PPB premises/
 *   professional-practice licences are real annual licences, always
 *   renewed to the following 31 December, never to an arbitrary
 *   anniversary date — so the default is **31 December of the year
 *   after the one the licence is issued in** (i.e. always at least a
 *   full year of validity, ending on the calendar year boundary every
 *   such licence in Kenya actually uses). If a licence is issued on
 *   1 Feb 2026, the default expiry is 31 Dec 2027, not 31 Dec 2026 —
 *   deliberately erring toward "at least one full year," not "whatever
 *   is left of the current year."
 */

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseIssuedOn(issuedOn?: string): Date {
  if (issuedOn) {
    const parsed = new Date(issuedOn)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

/** GMP certificates — `issuedOn + 3 years`. */
export function defaultGmpExpiryOn(issuedOn?: string): string {
  const base = parseIssuedOn(issuedOn)
  const expiry = new Date(base)
  expiry.setFullYear(expiry.getFullYear() + 3)
  return toIsoDate(expiry)
}

/** Facility premises licences & personnel licences — 31 December of the year after issuance. */
export function defaultAnnualLicenceExpiryOn(issuedOn?: string): string {
  const base = parseIssuedOn(issuedOn)
  const expiry = new Date(Date.UTC(base.getUTCFullYear() + 1, 11, 31))
  return toIsoDate(expiry)
}
