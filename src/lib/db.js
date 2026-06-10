import { supabase } from './supabase'

// Maps storage keys used in the app to Supabase table names
const TABLE = {
  pnd_rt_v5:  'road_tests',
  pnd_uni_v5: 'uniform_orders',
  pnd_tr_v5:  'trucks',
  pnd_inj_v5: 'injury_reports',
  pnd_acc_v2: 'accidents',
  pnd_hir_v1: 'hiring_requests',
  pnd_ins_v1: 'insurance_requests',
  pnd_dot_v1: 'dot_cards',
  pnd_term_v1: 'terminals',
  pnd_drv_v1:  'drivers',
}

// Load all records from a table. Returns an array matching the app's expected shape.
export async function dbLoad(key) {
  const { data, error } = await supabase
    .from(TABLE[key])
    .select('id, data')
    .order('inserted_at', { ascending: false })
  if (error) { console.error('dbLoad:', error.message); return [] }
  return (data || []).map(row => ({ ...row.data, id: row.id }))
}

// Persist the full updated array to Supabase.
// Upserts all current records, then deletes any rows that were removed.
export async function dbSave(key, records) {
  const table = TABLE[key]

  if (records.length > 0) {
    const rows = records.map(r => ({ id: r.id, data: r }))
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
    if (error) { console.error('dbSave upsert:', error.message); return }
  }

  // Find and remove rows that no longer exist in the current state
  const { data: existing } = await supabase.from(table).select('id')
  const currentIds = new Set(records.map(r => r.id))
  const toDelete = (existing || []).map(r => r.id).filter(id => !currentIds.has(id))
  if (toDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', toDelete)
    if (error) console.error('dbSave delete:', error.message)
  }
}
