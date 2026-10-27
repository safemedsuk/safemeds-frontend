/**
 * European Portuguese (pt-PT) message catalog — the third UI language,
 * added 27 Oct 2026 per explicit instruction. **Deliberately,
 * genuinely incomplete right now, on purpose** — unlike `fr.ts`
 * (typed as `Record<MessageKey, string>`, so a missing French key is a
 * compile error), this file is typed as a *partial* record: every key
 * not yet translated here falls back to English via
 * `useTranslation()`'s own existing missing-key fallback, exactly the
 * mechanism that already made the French rollout safe to ship
 * module-by-module instead of all at once.
 *
 * Rollout plan (confirmed with the user, 27 Oct 2026 — mirrors exactly
 * how French itself was built): architecture first (this file,
 * the locale enum, the Settings/public-form language switchers — all
 * done this pass), then real translation module by module in later
 * sessions, in this order: nav/sidebar chrome + auth flow + Settings
 * (the French "Stage 1" equivalent) → VigiCloud → QualCloud → RegCloud
 * → backend emails/notifications (`email-messages.ts`/
 * `notification-messages.ts`, European Portuguese there too). Track
 * progress in todo-i18n.md, not here.
 *
 * Variant: **European Portuguese**, not Brazilian — matches
 * SafeMeds' actual pan-African Lusophone markets (Mozambique, Angola,
 * Guinea-Bissau, Cape Verde, São Tomé and Príncipe), confirmed with
 * the user rather than assumed.
 */
import { en, type MessageKey } from './en'

export const pt: Partial<Record<MessageKey, string>> = {}

// Referencing `en` keeps the import used and gives a quick diff anchor
// for future reviewers comparing this file against the English source
// of truth as real translation work lands — same convention `fr.ts`
// already uses.
void en
