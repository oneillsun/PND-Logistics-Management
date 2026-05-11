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
