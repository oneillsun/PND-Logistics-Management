import { supabase } from './supabase'

export async function fetchTerminals() {
  const { data } = await supabase
    .from('terminals')
    .select('*')
    .order('code', { ascending: true })
  return data || []
}

export async function createTerminal(t) {
  const { error } = await supabase.from('terminals').insert({
    name:             t.name.trim(),
    code:             t.code.trim(),
    fulladdress:      t.fulladdress      || null,
    address:          t.address          || null,
    city:             t.city             || null,
    state:            t.state            || null,
    zipcode:          t.zipcode          || null,
    status:           t.status           || 'Active',
    rt_employer_name: t.rt_employer_name || null,
  })
  return error
}

export async function updateTerminal(id, t) {
  const { error } = await supabase.from('terminals').update({
    name:             t.name.trim(),
    code:             t.code.trim(),
    fulladdress:      t.fulladdress      || null,
    address:          t.address          || null,
    city:             t.city             || null,
    state:            t.state            || null,
    zipcode:          t.zipcode          || null,
    status:           t.status           || 'Active',
    rt_employer_name: t.rt_employer_name || null,
  }).eq('id', id)
  return error
}
