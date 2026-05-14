const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Build a branded HTML email body for road test outcomes
function buildOutcomeHtml(test) {
  const passed  = test.status === 'Passed'
  const accentColor = passed ? '#00cc66' : '#ff4444'
  const statusLabel = passed ? '✅ PASSED' : '❌ FAILED'
  const terminalInfo = test.terminal || '—'
  const testDate = test.date
    ? new Date(test.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '—'

  const rows = [
    ['Candidate',       test.candidateName || '—'],
    ['FedEx ID',        test.fedexId        || '—'],
    ['Phone',           test.phone          || '—'],
    ['Terminal',        terminalInfo],
    ['Test Date',       testDate],
    ['Test Time',       test.time           || '—'],
    ['Duration',        test.duration ? `${test.duration} min` : '—'],
    ['Result',          statusLabel],
    ...(passed && test.firstDay
      ? [['First Day of Training', new Date(test.firstDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })]]
      : []),
    ...(test.feedback ? [['Manager Feedback', test.feedback]] : []),
    ['Completed At',    test.completedAt ? new Date(test.completedAt).toLocaleString('en-US') : '—'],
  ]

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 14px;color:#8888aa;font-size:12px;font-family:monospace;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 14px;color:#eeeeff;font-size:13px;font-family:monospace;vertical-align:top;">${value}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#080812;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080812;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d0d22;border:1px solid #262642;border-radius:12px;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a1e;padding:24px 28px;border-bottom:1px solid #1e1e3a;">
            <span style="font-size:11px;color:#ff6200;font-family:monospace;letter-spacing:2px;text-transform:uppercase;">PND Logistics Management</span>
            <div style="font-size:22px;font-weight:800;color:#eeeeff;margin-top:6px;letter-spacing:1px;">Road Test Outcome</div>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="background:${passed ? '#071a0f' : '#1a0707'};border:1px solid ${accentColor};border-radius:8px;padding:14px 18px;font-size:20px;font-weight:700;color:${accentColor};font-family:monospace;letter-spacing:1px;">
              ${statusLabel} &nbsp;—&nbsp; ${test.candidateName || ''}
            </div>
          </td>
        </tr>

        <!-- Detail table -->
        <tr>
          <td style="padding:20px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111128;border:1px solid #1e1e3a;border-radius:8px;overflow:hidden;">
              ${tableRows}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #1e1e3a;">
            <span style="font-size:11px;color:#44447a;font-family:monospace;">This is an automated notification from PND Logistics Management.</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Generic email infrastructure ─────────────────────────────────────────────

function interpolate(template, data) {
  return (template || '').replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? '')
}

function buildFallbackHtml(placeholders) {
  const rows = Object.entries(placeholders)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `
      <tr>
        <td style="padding:7px 14px;color:#8888aa;font-size:12px;font-family:monospace;white-space:nowrap;vertical-align:top;">${k}</td>
        <td style="padding:7px 14px;color:#eeeeff;font-size:13px;font-family:monospace;vertical-align:top;">${v}</td>
      </tr>`).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#080812;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080812;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d0d22;border:1px solid #262642;border-radius:12px;overflow:hidden;max-width:100%;">
        <tr>
          <td style="background:#0a0a1e;padding:24px 28px;border-bottom:1px solid #1e1e3a;">
            <span style="font-size:11px;color:#ff6200;font-family:monospace;letter-spacing:2px;text-transform:uppercase;">PND Logistics Management</span>
            <div style="font-size:20px;font-weight:800;color:#eeeeff;margin-top:6px;">Notification</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111128;border:1px solid #1e1e3a;border-radius:8px;overflow:hidden;">
              ${rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 20px;border-top:1px solid #1e1e3a;">
            <span style="font-size:11px;color:#44447a;font-family:monospace;">This is an automated notification from PND Logistics Management.</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function sendEmail({ to, cc, subject, html }) {
  const toArr = (Array.isArray(to) ? to : (to || '').split(',').map(s => s.trim())).filter(Boolean)
  const ccArr = (Array.isArray(cc) ? cc : (cc || '').split(',').map(s => s.trim())).filter(Boolean)
  if (!toArr.length) {
    console.warn('[email] No recipients — skipping.')
    return { skipped: true }
  }
  const payload = { to: toArr, subject, html }
  if (ccArr.length) payload.cc = ccArr

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[email] Edge function error:', err)
    return { error: err }
  }
  return { ok: true }
}

export async function sendModuleEmail(moduleKey, placeholders, settings, toOverride) {
  const cfg = settings?.[moduleKey]
  console.log(`[email] sendModuleEmail(${moduleKey}) cfg:`, JSON.stringify(cfg))
  if (!cfg?.enabled) return { skipped: true }
  const to = toOverride?.trim() || cfg.to?.trim()
  if (!to) return { skipped: true }
  const subject = interpolate(cfg.subject, placeholders)
  const html = cfg.body
    ? `<div style="font-family:Arial,sans-serif;background:#080812;color:#eeeeff;padding:24px;">${interpolate(cfg.body, placeholders).replace(/\n/g, '<br/>')}</div>`
    : buildFallbackHtml(placeholders)
  try {
    return await sendEmail({ to, cc: cfg.cc, subject, html })
  } catch (err) {
    console.error('[email] sendEmail threw:', err)
    return { error: err.message || String(err) }
  }
}

