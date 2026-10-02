/**
 * The single, shared max-upload-size constant for every file-upload UI in
 * this app. Must stay in sync with the backend's own
 * `src/common/upload-limits.const.ts` (`MAX_UPLOAD_BYTES`, 10MB) — see
 * that file's own doc comment for why 10MB (not a much smaller number
 * like 1MB) is the real, deliberate choice: a real regulatory PDF/scan
 * routinely runs several MB, and a too-aggressive client-side cap would
 * itself become the support complaint.
 *
 * Found and fixed as part of a real-usage report that uploads were
 * "silently failing" for files a few MB in size: there was previously no
 * client-side size check anywhere in the app — every upload component
 * round-tripped to the backend and only then (sometimes) learned the
 * file was too large, and a handful of call sites didn't surface that
 * error clearly, or a slow/oversized multipart upload could leave the
 * UI's loading state hanging with no visible error at all if the
 * underlying connection was interrupted mid-upload. `lib/api/client.ts`'s
 * `rawFetch()` now checks every `FormData` body against this constant
 * before ever calling `fetch()` — instant, consistent feedback across
 * every upload call site in the app, not re-implemented per component.
 */
export const MAX_UPLOAD_SIZE_MB = 10
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

export function fileTooLargeMessage(fileName?: string): string {
  const prefix = fileName ? `"${fileName}" exceeds` : 'This file exceeds'
  return `${prefix} the maximum upload size of ${MAX_UPLOAD_SIZE_MB}MB — please use a smaller file.`
}

/** Returns a clear message if `file` is too large to even attempt uploading, or `null` if it's fine. */
export function validateUploadSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return fileTooLargeMessage(file.name)
  }
  return null
}
