import { supabase } from './supabase'

export const EMAIL_LIST_MODULES = [
  { key: 'rt',    label: 'Road Tests' },
  { key: 'uni',   label: 'Uniform Orders' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'inj',   label: 'Injury Reports' },
  { key: 'acc',   label: 'Accidents' },
  { key: 'hir',   label: 'Hiring' },
  { key: 'ins',   label: 'Insurance' },
  { key: 'dot',   label: 'DOT Cards' },
];

export async function fetchEmailList() {
  const { data, error } = await supabase.from('email_list').select('module, emails');
  if (error || !data) return {};
  return Object.fromEntries(data.map(r => [r.module, r.emails]));
}

export async function saveEmailList(list) {
  const rows = Object.entries(list).map(([module, emails]) => ({ module, emails: emails || '' }));
  const { error } = await supabase.from('email_list').upsert(rows, { onConflict: 'module' });
  return error;
}
