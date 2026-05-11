import { supabase } from './supabase'

const SETTINGS_ID = 'email_notifications'

export const DEFAULT_SETTINGS = {
  roadTestOutcome: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Road Test {{status}} - {{candidateName}}',
    body: '',
  },
}

export async function fetchEmailSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('id', SETTINGS_ID)
    .single()
  if (error) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...data.data }
}

export async function saveEmailSettings(settings) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, data: settings })
  return error
}
