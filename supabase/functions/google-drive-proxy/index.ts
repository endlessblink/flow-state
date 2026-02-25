/**
 * Supabase Edge Function: google-drive-proxy
 *
 * Proxies Google Drive API requests on behalf of authenticated FlowState users.
 * Google OAuth tokens are passed per-request from the client (never stored here).
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are read from Supabase secrets for
 * token refresh flows (same env vars as google-calendar-proxy).
 *
 * Supported actions:
 * - upload:       Upload an image file to the FlowState folder in Google Drive
 * - download:     Fetch raw file content (binary) for preview/display
 * - delete:       Delete a file from Google Drive
 * - get-metadata: Get file metadata (thumbnailLink, webViewLink, name, mimeType)
 *
 * Upload flow:
 *   1. Find or create a top-level "FlowState" folder in the user's Drive
 *   2. Multipart-upload the base64-encoded file into that folder
 *   3. Grant "reader / anyone" permission so thumbnail URLs are publicly accessible
 *
 * Token refresh: if a Google API call returns 401 and googleRefreshToken is present,
 * the function refreshes the token and retries, returning newAccessToken to the client.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Types
// ============================================================================

interface GoogleDriveProxyRequest {
  action: 'upload' | 'download' | 'delete' | 'get-metadata'
  googleToken: string
  googleRefreshToken?: string
  // upload
  fileName?: string
  mimeType?: string
  fileData?: string   // base64-encoded file content
  // download | delete | get-metadata
  fileId?: string
}

interface DriveFileMetadata {
  fileId: string
  name: string
  mimeType: string
  thumbnailLink?: string
  webViewLink?: string
  newAccessToken?: string
}

interface DriveUploadResult extends DriveFileMetadata {
  // no extra fields beyond DriveFileMetadata
}

interface TokenRefreshResponse {
  access_token: string
  expires_in: number
  token_type: string
}

// ============================================================================
// CORS Headers
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://in-theflow.com',
  'https://www.in-theflow.com',
  'http://localhost:5546',   // dev server
  'tauri://localhost',        // Tauri desktop app
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// ============================================================================
// Auth Validation
// ============================================================================

/**
 * Validate Supabase JWT from the Authorization header.
 * Returns the authenticated user or throws on failure.
 */
async function validateSupabaseAuth(req: Request): Promise<{ id: string }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment not configured')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Invalid or expired Supabase session')
  }

  return user
}

// ============================================================================
// Google Token Refresh
// ============================================================================

/**
 * Exchange a refresh token for a new access token via Google OAuth2.
 * Reads the same env vars as google-calendar-proxy (shared Doppler secrets).
 */
async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET') || Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials not configured (SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID / SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)'
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Google token refresh failed:', response.status, errorText)
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const data: TokenRefreshResponse = await response.json()
  return data.access_token
}

// ============================================================================
// Drive Helpers
// ============================================================================

/**
 * Throw a typed error carrying the HTTP status so the 401-retry logic can
 * distinguish expired-token errors from other API failures.
 */
function driveError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

/**
 * Find the "FlowState" folder in the user's Drive root.
 * Returns the folder id, or null if not found.
 */
async function findFlowStateFolder(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(
    "name='FlowState' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  )
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await response.text()
    console.error('Drive folder search error:', response.status, text)
    throw new Error(`Google Drive API error: ${response.status}`)
  }

  const data = await response.json()
  const files: Array<{ id: string; name: string }> = data.files || []
  return files.length > 0 ? files[0].id : null
}

/**
 * Create the "FlowState" folder in the user's Drive root.
 * Returns the new folder id.
 */
async function createFlowStateFolder(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'FlowState',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await response.text()
    console.error('Drive folder create error:', response.status, text)
    throw new Error(`Google Drive API error: ${response.status}`)
  }

  const data = await response.json()
  return data.id as string
}

/**
 * Ensure the FlowState folder exists, creating it if necessary.
 * Returns the folder id.
 */
async function ensureFlowStateFolder(accessToken: string): Promise<string> {
  const existing = await findFlowStateFolder(accessToken)
  if (existing) return existing
  console.log('FlowState folder not found, creating...')
  return await createFlowStateFolder(accessToken)
}

/**
 * Grant "reader / anyone" permission on a Drive file so thumbnail URLs
 * returned by the API are publicly accessible (required for <img> src usage).
 */
async function makeFilePubliclyReadable(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  )

  if (!response.ok) {
    // Non-fatal: log but don't abort the upload
    const text = await response.text()
    console.warn(`Could not set public permission on file ${fileId}:`, response.status, text)
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * upload: Multipart-upload a base64-encoded image into the FlowState Drive folder.
 * Makes the file publicly readable so thumbnailLink works in <img> tags.
 */
async function uploadFile(
  accessToken: string,
  fileName: string,
  mimeType: string,
  fileDataBase64: string
): Promise<DriveUploadResult> {
  // 1. Decode base64 to binary
  const binaryString = atob(fileDataBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  // 2. Ensure target folder exists
  const folderId = await ensureFlowStateFolder(accessToken)

  // 3. Build multipart body
  //    Part 1: file metadata JSON
  //    Part 2: raw binary content
  const boundary = '-------flowstate_upload_boundary_' + Date.now()
  const metadataJson = JSON.stringify({ name: fileName, parents: [folderId] })

  // Construct multipart body as Uint8Array
  const encoder = new TextEncoder()
  const preamble = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataJson}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  )
  const epilogue = encoder.encode(`\r\n--${boundary}--`)

  const multipartBody = new Uint8Array(preamble.length + bytes.length + epilogue.length)
  multipartBody.set(preamble, 0)
  multipartBody.set(bytes, preamble.length)
  multipartBody.set(epilogue, preamble.length + bytes.length)

  // 4. Upload
  const uploadUrl =
    `https://www.googleapis.com/upload/drive/v3/files` +
    `?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink`

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipartBody,
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await response.text()
    console.error('Drive upload error:', response.status, text)
    throw new Error(`Google Drive upload error: ${response.status}`)
  }

  const data = await response.json()

  // 5. Make publicly readable (best-effort — thumbnails require this)
  await makeFilePubliclyReadable(accessToken, data.id)

  return {
    fileId: data.id,
    name: data.name,
    mimeType: data.mimeType,
    webViewLink: data.webViewLink,
    thumbnailLink: data.thumbnailLink,
  }
}

/**
 * download: Fetch the raw file content from Drive.
 * Returns a Response with the binary body and the file's Content-Type.
 */
async function downloadFile(
  accessToken: string,
  fileId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // First fetch metadata to get mimeType
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!metaResponse.ok) {
    if (metaResponse.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await metaResponse.text()
    console.error('Drive metadata error:', metaResponse.status, text)
    throw new Error(`Google Drive API error: ${metaResponse.status}`)
  }

  const meta = await metaResponse.json()

  // Then fetch binary content
  const contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const contentResponse = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!contentResponse.ok) {
    if (contentResponse.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await contentResponse.text()
    console.error('Drive download error:', contentResponse.status, text)
    throw new Error(`Google Drive download error: ${contentResponse.status}`)
  }

  const blob = await contentResponse.blob()
  return new Response(blob, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': meta.mimeType || 'application/octet-stream',
    },
  })
}

/**
 * delete: Permanently delete a file from the user's Drive.
 */
async function deleteFile(accessToken: string, fileId: string): Promise<{ success: true }> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    // 404 is acceptable — file already gone
    if (response.status !== 404) {
      const text = await response.text()
      console.error('Drive delete error:', response.status, text)
      throw new Error(`Google Drive delete error: ${response.status}`)
    }
  }

  return { success: true }
}

/**
 * get-metadata: Return Drive metadata for a single file.
 */
async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMetadata> {
  const url =
    `https://www.googleapis.com/drive/v3/files/${fileId}` +
    `?fields=id,name,mimeType,thumbnailLink,webViewLink`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw driveError(401, 'Google token expired')
    }
    const text = await response.text()
    console.error('Drive get-metadata error:', response.status, text)
    throw new Error(`Google Drive API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    fileId: data.id,
    name: data.name,
    mimeType: data.mimeType,
    thumbnailLink: data.thumbnailLink,
    webViewLink: data.webViewLink,
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate Supabase auth
    try {
      await validateSupabaseAuth(req)
    } catch (authError) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: (authError as Error).message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: GoogleDriveProxyRequest = await req.json()

    // Validate action
    const VALID_ACTIONS = ['upload', 'download', 'delete', 'get-metadata']
    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Supported: ${VALID_ACTIONS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate googleToken
    if (!body.googleToken) {
      return new Response(
        JSON.stringify({ error: 'googleToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Per-action parameter validation
    if (body.action === 'upload') {
      if (!body.fileName || !body.mimeType || !body.fileData) {
        return new Response(
          JSON.stringify({ error: 'fileName, mimeType, and fileData are required for upload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // download | delete | get-metadata
      if (!body.fileId) {
        return new Response(
          JSON.stringify({ error: `fileId is required for ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Execute action with optional token refresh on 401
    let accessToken = body.googleToken
    let newAccessToken: string | undefined

    // download is special — it returns a binary Response, not JSON
    const isDownload = body.action === 'download'

    const executeAction = async (): Promise<object | Response> => {
      switch (body.action) {
        case 'upload':
          return await uploadFile(accessToken, body.fileName!, body.mimeType!, body.fileData!)
        case 'download':
          return await downloadFile(accessToken, body.fileId!, corsHeaders)
        case 'delete':
          return await deleteFile(accessToken, body.fileId!)
        case 'get-metadata':
          return await getFileMetadata(accessToken, body.fileId!)
        default:
          throw new Error(`Unknown action: ${body.action}`)
      }
    }

    let result: object | Response
    try {
      result = await executeAction()
    } catch (err) {
      const apiErr = err as Error & { status?: number }
      if (apiErr.status === 401 && body.googleRefreshToken) {
        // Token expired — attempt refresh and retry once
        console.log('Google token expired, attempting refresh...')
        try {
          accessToken = await refreshGoogleToken(body.googleRefreshToken)
          newAccessToken = accessToken
          result = await executeAction()
        } catch (refreshErr) {
          console.error('Token refresh or retry failed:', refreshErr)
          return new Response(
            JSON.stringify({
              error: 'Google token expired and refresh failed',
              message: (refreshErr as Error).message,
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else if (apiErr.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Google token expired. Please reconnect your Google account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        throw err
      }
    }

    // For download, the result is already a complete Response — return it directly.
    // (Token refresh for download would have produced a new binary Response too.)
    if (isDownload) {
      return result as Response
    }

    // For all other actions, return JSON, optionally including newAccessToken
    const responseBody = newAccessToken
      ? { ...(result as object), newAccessToken }
      : result

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
