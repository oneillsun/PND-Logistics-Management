import { supabase } from './supabase'

const BUCKET = 'dot-cards'

function normalizeId(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function uploadDotCardFile(dotCardId, file) {
  if (!dotCardId) return { error: 'Missing dotCardId for file upload.' }
  if (!file)      return { error: 'Missing file for upload.' }

  const ext  = file.name.split('.').pop() || 'pdf'
  const path = `${normalizeId(dotCardId)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' })

  if (uploadError) {
    const msg = String(uploadError.message || uploadError || '')
    if (msg.toLowerCase().includes('bucket not found'))
      return { error: `Storage bucket "${BUCKET}" not found. Create it in Supabase Storage.` }
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('row-level'))
      return { error: `Upload blocked by storage permissions on bucket "${BUCKET}".` }
    return { error: msg || 'Unknown upload error.' }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) return { error: `Could not get public URL from bucket "${BUCKET}".` }
  return { url: data.publicUrl }
}
