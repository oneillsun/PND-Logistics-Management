import { supabase } from './supabase'

const SESSION_KEY = 'pnd_auth_v1'

// ── Session ────────────────────────────────────────────────────────────────
export function getSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

// ── Login ──────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, username, role, terminal, phone, email, fedex_id, status')
    .eq('username', username.trim())
    .eq('password', password)
    .eq('status', 'active')
    .single()

  if (error || !data) return null
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  return data
}

// ── User management (admin only) ───────────────────────────────────────────
export async function fetchUsers() {
  const { data } = await supabase
    .from('users')
    .select('id, name, username, password, role, terminal, phone, email, fedex_id, status, created_at')
    .order('created_at', { ascending: true })
  return data || []
}

export async function createUser(user) {
  const { error } = await supabase.from('users').insert({
    name:     user.name,
    username: user.username.trim(),
    password: user.password,
    role:     user.role,
    terminal: user.terminal || null,
    phone:    user.phone    || null,
    email:    user.email    || null,
    fedex_id: user.fedexId  || null,
    status:   user.status,
  })
  return error
}

export async function updateUser(id, updates) {
  const payload = {
    name:     updates.name,
    role:     updates.role,
    terminal: updates.terminal || null,
    phone:    updates.phone    || null,
    email:    updates.email    || null,
    fedex_id: updates.fedexId  || null,
    status:   updates.status,
  }
  // Only update password if a new one was provided
  if (updates.password) payload.password = updates.password
  const { error } = await supabase.from('users').update(payload).eq('id', id)
  return error
}
