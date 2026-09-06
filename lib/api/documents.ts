import { get, post } from './client'

export type DocumentVersionStatus = 'pending' | 'stored' | 'failed'

export interface DocumentVersion {
  id: string
  documentId: string
  version: number
  filename: string
  contentType: string
  key: string
  sha256: string | null
  sizeBytes: number | null
  status: DocumentVersionStatus
  uploadedBy: string
  createdAt: string
}

export interface DocumentWithVersions {
  id: string
  companyId: string
  recordType: string
  recordId: string
  title: string
  createdBy: string
  createdAt: string
  updatedAt: string
  versions: DocumentVersion[]
}

export interface UploadIntent {
  document: DocumentWithVersions
  version: DocumentVersion
  uploadUrl: string
  maxSizeBytes: number
}

export async function listDocuments(recordType: string, recordId: string): Promise<DocumentWithVersions[]> {
  const { data } = await get<DocumentWithVersions[]>(`/records/${recordType}/${recordId}/documents`)
  return data
}

export interface DirectUploadResult {
  document: DocumentWithVersions
  version: DocumentVersion
}

/**
 * The upload path every screen actually uses — streams the file through
 * our own backend (multipart), which puts it straight into R2 server-side
 * via `StorageService.putObject()`. This is what `uploadDocument()` below
 * calls. See its own comment for why this replaced the presigned-URL/
 * browser-to-R2 path (`registerUpload`/`uploadToPresignedUrl`/
 * `completeUpload` below): that path needs R2 bucket CORS configuration
 * this environment doesn't have, and silently left a `DocumentVersion`
 * stuck in `pending` status forever (visible in the UI as a permanent
 * yellow "pending" badge) whenever the browser's direct PUT to R2 failed.
 */
async function uploadDirect(
  recordType: string,
  recordId: string,
  file: File,
  opts: { title?: string; documentId?: string } = {},
): Promise<DirectUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (opts.title) formData.append('title', opts.title)
  if (opts.documentId) formData.append('documentId', opts.documentId)

  const { data } = await post<DirectUploadResult>(`/records/${recordType}/${recordId}/documents/upload`, formData)
  return data
}

export async function registerUpload(
  recordType: string,
  recordId: string,
  payload: { title?: string; documentId?: string; filename: string; contentType: string },
): Promise<UploadIntent> {
  const { data } = await post<UploadIntent>(`/records/${recordType}/${recordId}/documents`, payload)
  return data
}

export async function completeUpload(documentId: string, versionId: string): Promise<DocumentVersion> {
  const { data } = await post<DocumentVersion>(`/documents/${documentId}/versions/${versionId}/complete`)
  return data
}

export async function getDownloadUrl(documentId: string, versionId: string): Promise<string> {
  const { data } = await get<{ url: string }>(`/documents/${documentId}/versions/${versionId}/download`)
  return data.url
}

/**
 * The one step that deliberately does NOT go through `lib/api/client.ts`'s
 * `apiRequest` wrapper — this PUTs the raw file bytes straight to R2 using
 * the presigned URL, not to our own API, so it must not carry our
 * `credentials: 'include'`/CSRF-header/401-refresh-retry behaviour.
 *
 * **Not called by `uploadDocument()` below** — kept for a future
 * large-file/resumable-upload client once R2 bucket CORS is configured
 * (see `uploadDocument()`'s comment). Calling this directly today will
 * fail in a real browser with a CORS error at the preflight `OPTIONS`
 * step; `curl` against the presigned URL still works fine, since curl
 * doesn't enforce CORS.
 */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
  if (!res.ok) {
    throw new Error(`Upload to storage failed (${res.status})`)
  }
}

/**
 * The function every screen calls to upload a document. Goes through
 * `uploadDirect()` (server-proxied, one request) rather than the
 * `registerUpload` → `uploadToPresignedUrl` → `completeUpload` three-step
 * handshake above — that handshake's middle step requires R2 bucket CORS
 * configuration this environment doesn't have, and a failure there used
 * to leave a `DocumentVersion` permanently stuck in `pending` status
 * (shown in the UI as a yellow "pending" badge that never resolved,
 * since nothing ever called `completeUpload()`). `uploadDirect()` has no
 * such window — the version is created already `stored`.
 */
export async function uploadDocument(
  recordType: string,
  recordId: string,
  file: File,
  opts: { title?: string; documentId?: string } = {},
): Promise<DocumentVersion> {
  const result = await uploadDirect(recordType, recordId, file, opts)
  return result.version
}
