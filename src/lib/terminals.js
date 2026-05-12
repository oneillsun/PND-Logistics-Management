import { supabase } from './supabase'

function normalizeId(name) {
  return name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function fetchTerminals() {
  const { data, error } = await supabase
    .from('terminals')
    .select('id, data')
    .order('inserted_at', { ascending: true })

  if (error) {
    console.error('fetchTerminals:', error.message)
    return []
  }

  return (data || []).map(row => ({ ...row.data, id: row.id }))
}

export async function createTerminal(t) {
  const id = t.id || normalizeId(t.name || t.code || String(Date.now()))
  const { error } = await supabase.from('terminals').insert({
    id,
    data: { ...t, id },
  })
  return error
}

export async function updateTerminal(id, t) {
  const { error } = await supabase.from('terminals').update({
    data: { ...t, id },
  }).eq('id', id)
  return error
}

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'terminal-pdfs'

function getStorageErrorMessage(error, bucket) {
  const message = String(error?.message || error || '')
  const lower = message.toLowerCase()

  if (lower.includes('bucket not found') || lower.includes('404')) {
    return `Storage bucket "${bucket}" not found. Create the bucket in Supabase Storage or set VITE_SUPABASE_STORAGE_BUCKET to the correct bucket name.`
  }

  if (lower.includes('row-level security') || lower.includes('row level security') || lower.includes('permission denied') || lower.includes('forbidden')) {
    return `Storage upload blocked by Supabase Storage permissions / row-level security. Verify that bucket "${bucket}" exists and that the current Supabase auth role can upload files to it.`
  }

  return message || 'Unknown storage upload error.'
}

async function resolvePdfUrl(path) {
  const { data, error } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  if (!error && data?.publicUrl) {
    return { url: data.publicUrl }
  }

  if (error) {
    console.warn('getPublicUrl failed, trying signed URL', error)
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60)

  if (!signedError && signedData?.signedUrl) {
    return { url: signedData.signedUrl }
  }

  console.error('resolvePdfUrl failed', signedError)
  return { error: `Uploaded PDF could not be published. Check storage bucket permissions for "${STORAGE_BUCKET}".` }
}

export async function uploadTerminalPdf(terminalId, file) {
  if (!terminalId) {
    return { error: 'Missing terminalId for PDF upload.' }
  }

  if (!file) {
    return { error: 'Missing file for PDF upload.' }
  }

  const path = `${normalizeId(terminalId)}.pdf`
  try {
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) {
      return { error: getStorageErrorMessage(uploadError, STORAGE_BUCKET) }
    }

    const urlResult = await resolvePdfUrl(path)
    if (urlResult.error) {
      return { error: urlResult.error }
    }

    return { url: urlResult.url }
  } catch (error) {
    console.error('uploadTerminalPdf failed', error)
    return { error: String(error) }
  }
}
