import { supabase } from '@/services/auth/supabase'

const BUCKET = 'canvas-images'
const MAX_WIDTH = 1200
const WEBP_QUALITY = 0.75
const JPEG_QUALITY = 0.8

/**
 * Compress a pasted image to max 1200px wide, exported as WebP (or JPEG fallback).
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Try WebP first; fall back to JPEG if the browser returns an empty blob
  const blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY)
  if (blob && blob.size > 0) return blob

  const fallback = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY)
  if (!fallback || fallback.size === 0) throw new Error('Image compression produced an empty blob')
  return fallback
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Upload a compressed image blob to Supabase Storage.
 * Falls back to a base64 data URL when supabase is null (guest / offline mode).
 */
export async function uploadCanvasImage(blob: Blob, userId: string): Promise<string> {
  if (!supabase) {
    return blobToDataUrl(blob)
  }

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${Date.now()}-${random}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  })

  if (error) throw new Error(`Canvas image upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Extract the first image File from a ClipboardEvent, or null if none found.
 */
export function getClipboardImage(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items
  if (!items) return null

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

/**
 * Delete a previously uploaded canvas image from Supabase Storage.
 * No-ops when supabase is null or the URL is a data URL.
 */
export async function deleteCanvasImage(imageUrl: string): Promise<void> {
  if (!supabase || imageUrl.startsWith('data:')) return

  const path = extractPathFromUrl(imageUrl)
  if (!path) return

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`Canvas image delete failed: ${error.message}`)
}

/**
 * Extract the storage path (`{userId}/{filename}`) from a Supabase public URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
function extractPathFromUrl(url: string): string | null {
  // Public URLs look like: .../storage/v1/object/public/canvas-images/{userId}/{file}
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}
