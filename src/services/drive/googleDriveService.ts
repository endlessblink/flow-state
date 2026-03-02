/**
 * Google Drive Proxy Client
 *
 * Client service for proxying Google Drive API requests through the
 * Supabase Edge Function `google-drive-proxy`. This keeps OAuth tokens
 * and refresh logic server-side, preventing direct Google API calls from
 * the client bundle.
 *
 * Supports:
 * - Uploading images to Google Drive (with client-side compression)
 * - Deleting images from Google Drive
 * - Getting file metadata (thumbnail URLs)
 *
 * @see FEATURE-1414 in MASTER_PLAN.md - Task Image Attachments
 */

import { supabase } from '@/services/auth/supabase'
import { tauriFetch } from '@/services/ai/utils/tauriHttp'

// ============================================================================
// Types
// ============================================================================

export interface DriveAttachment {
  id: string           // Local UUID
  driveFileId: string  // Google Drive file ID
  name: string         // Original filename
  mimeType: string     // e.g. 'image/jpeg'
  thumbnailUrl?: string
  uploadedAt: string   // ISO date
}

export interface UploadProgress {
  status: 'compressing' | 'uploading' | 'done' | 'error'
  progress: number // 0-100
}

// ============================================================================
// URL Resolution (same pattern as calendar service)
// ============================================================================

const envUrl = import.meta.env.VITE_SUPABASE_URL || ''

function resolveSupabaseUrl(): string {
  if (!envUrl) return ''
  if (envUrl.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${envUrl}`
  }
  return envUrl
}

// ============================================================================
// Internal Proxy Helper
// ============================================================================

async function callGoogleDriveProxy(body: Record<string, unknown>): Promise<unknown> {
  const supabaseUrl = resolveSupabaseUrl()
  if (!supabaseUrl) {
    throw new Error('[GoogleDriveService] VITE_SUPABASE_URL is not configured')
  }

  const url = `${supabaseUrl}/functions/v1/google-drive-proxy`

  if (!supabase) {
    throw new Error('[GoogleDriveService] Supabase client is not initialised')
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('[GoogleDriveService] No active Supabase session — user must be signed in')
  }

  const response = await tauriFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorData = await response.json() as { error?: string; message?: string }
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(`[GoogleDriveService] Proxy request failed: ${errorMessage}`)
  }

  return response.json()
}

// ============================================================================
// Image Compression (client-side, no dependencies)
// ============================================================================

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB before compression

async function compressImage(file: File): Promise<{ data: string; mimeType: string; thumbnailDataUrl: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
  }

  // Create image bitmap from file
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  // Calculate target dimensions (max 1920px on longest edge)
  let targetWidth = width
  let targetHeight = height
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    targetWidth = Math.round(width * ratio)
    targetHeight = Math.round(height * ratio)
  }

  // Draw to canvas and export as JPEG
  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })

  // Generate small thumbnail data URL (~2-5KB) for instant preview
  const THUMB_SIZE = 120
  const thumbRatio = Math.min(THUMB_SIZE / targetWidth, THUMB_SIZE / targetHeight)
  const thumbW = Math.round(targetWidth * thumbRatio)
  const thumbH = Math.round(targetHeight * thumbRatio)
  const thumbCanvas = new OffscreenCanvas(thumbW, thumbH)
  const thumbCtx = thumbCanvas.getContext('2d')!
  thumbCtx.drawImage(bitmap, 0, 0, thumbW, thumbH)
  bitmap.close()
  const thumbBlob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 })
  const thumbBuffer = await thumbBlob.arrayBuffer()
  const thumbBytes = new Uint8Array(thumbBuffer)
  let thumbBinary = ''
  for (let i = 0; i < thumbBytes.length; i++) {
    thumbBinary += String.fromCharCode(thumbBytes[i])
  }
  const thumbnailDataUrl = `data:image/jpeg;base64,${btoa(thumbBinary)}`

  // Convert full image to base64 for upload
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  return { data: base64, mimeType: 'image/jpeg', thumbnailDataUrl }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Upload an image to Google Drive via the edge function proxy.
 * Compresses the image client-side before uploading.
 *
 * @param file - The image File to upload
 * @param googleToken - Current Google OAuth access token
 * @param googleRefreshToken - Optional refresh token for auto-renewal
 * @param onProgress - Optional callback for upload progress
 * @returns DriveAttachment metadata for storing in the task
 */
export async function uploadImage(
  file: File,
  googleToken: string,
  googleRefreshToken?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ attachment: DriveAttachment; newAccessToken?: string }> {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`)
  }

  // Compress
  onProgress?.({ status: 'compressing', progress: 10 })
  const compressed = await compressImage(file)

  // Upload via proxy
  onProgress?.({ status: 'uploading', progress: 40 })
  const data = await callGoogleDriveProxy({
    action: 'upload',
    googleToken,
    ...(googleRefreshToken ? { googleRefreshToken } : {}),
    fileName: file.name.replace(/\.[^.]+$/, '.jpg'), // Replace extension with .jpg (compressed)
    mimeType: compressed.mimeType,
    fileData: compressed.data,
  }) as { fileId: string; name: string; mimeType: string; webViewLink: string; thumbnailLink?: string; newAccessToken?: string }

  onProgress?.({ status: 'done', progress: 100 })

  return {
    attachment: {
      id: crypto.randomUUID(),
      driveFileId: data.fileId,
      name: data.name || file.name,
      mimeType: data.mimeType || compressed.mimeType,
      thumbnailUrl: compressed.thumbnailDataUrl,
      uploadedAt: new Date().toISOString(),
    },
    ...(data.newAccessToken ? { newAccessToken: data.newAccessToken } : {}),
  }
}

/**
 * Delete an image from Google Drive via the edge function proxy.
 */
export async function deleteImage(
  driveFileId: string,
  googleToken: string,
  googleRefreshToken?: string,
): Promise<{ newAccessToken?: string }> {
  const data = await callGoogleDriveProxy({
    action: 'delete',
    googleToken,
    ...(googleRefreshToken ? { googleRefreshToken } : {}),
    fileId: driveFileId,
  }) as { success: boolean; newAccessToken?: string }

  return {
    ...(data.newAccessToken ? { newAccessToken: data.newAccessToken } : {}),
  }
}

/**
 * Get file metadata (including thumbnail URL) from Google Drive.
 */
export async function getFileMetadata(
  driveFileId: string,
  googleToken: string,
  googleRefreshToken?: string,
): Promise<{ thumbnailLink?: string; webViewLink?: string; newAccessToken?: string }> {
  const data = await callGoogleDriveProxy({
    action: 'get-metadata',
    googleToken,
    ...(googleRefreshToken ? { googleRefreshToken } : {}),
    fileId: driveFileId,
  }) as { thumbnailLink?: string; webViewLink?: string; newAccessToken?: string }

  return data
}

/**
 * Construct a Google Drive thumbnail URL for a given file ID.
 * Uses lh3.googleusercontent.com which serves images directly without redirects.
 * Requires the file to have public 'anyone/reader' permission.
 * Falls back to drive.google.com/thumbnail if needed.
 */
export function getThumbnailUrl(driveFileId: string, size = 220): string {
  return `https://lh3.googleusercontent.com/d/${driveFileId}=s${size}`
}
