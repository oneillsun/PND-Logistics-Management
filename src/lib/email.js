import { supabase } from './supabase'

// Build a branded HTML email body for road test outcomes
export function buildOutcomeHtml(test) {
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
    ...(test.default_unit_number ? [['Vehicle Number', test.default_unit_number]] : []),
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

const MODULE_TITLES = {
  roadTestNew:         'Road Test Scheduled',
  uniformOrderNew:     'Uniform Order',
  injuryReportNew:     'Work Injury Report',
  dotCardNew:          'DOT Card',
  insuranceRequestNew: 'Insurance Enrollment',
  hiringRequestNew:    'Hiring Request',
  accidentReportNew:   'Accident Report',
  roadTestOutcome:     'Road Test Outcome',
}

const LABEL_MAP = {
  terminal:        'Terminal',
  terminalAddress: 'Terminal Address',
  requestedBy:     'Requested By',
  createdAt:       'Date',
  candidateName:   'Candidate Name',
  phone:           'Phone',
  date:            'Test Date',
  time:            'Test Time',
  duration:        'Duration',
  manager:         'Manager',
  managerPhone:    'Manager Phone',
  driverCount:     'Driver Count',
  driverNames:     'Drivers',
  itemSummary:     'Items Ordered',
  notes:           'Notes',
  employeeName:    'Employee',
  employeePhone:   'Employee Phone',
  has30Days:       '30-Day Window',
  bodyPart:        'Body Part Injured',
  injuryDate:      'Date of Injury',
  injuryTime:      'Time of Injury',
  injuryAddress:   'Location',
  description:     'Description',
  medicalAttention:'Medical Attention',
  medicalProvider: 'Medical Provider',
  missedWork:      'Will Miss Work',
  missedDays:      'Days Missed',
  witnesses:       'Witnesses',
  reportedBy:      'Reported By',
  driverName:      'Driver',
  fedexId:         'FedEx ID',
  vehicleId:       'Vehicle ID',
  vehicleYear:     'Vehicle Year',
  vehicleMake:     'Vehicle Make',
  vehicleModel:    'Vehicle Model',
  accidentDate:    'Date of Accident',
  accidentTime:    'Time of Accident',
  accidentAddress: 'Location',
  victimName:      'Victim Name',
  victimPhone:     'Victim Phone',
  victimYear:      'Victim Vehicle Year',
  victimMake:      'Victim Vehicle Make',
  victimModel:     'Victim Vehicle Model',
  victimColor:     'Victim Vehicle Color',
  victimPlate:     'Victim License Plate',
  vderWorking:     'VDER Working',
  v360Working:     '360 Camera Working',
  action:          'Action',
  driversNeeded:   'Drivers Needed',
  urgency:         'Urgency',
  reason:          'Reason',
  firstName:       'First Name',
  lastName:        'Last Name',
  expirationDate:  'Expiration Date',
}

function humanizeKey(k) {
  return LABEL_MAP[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function buildModuleHtml(title, placeholders, bodyText) {
  const calendarUrl = placeholders._calendarUrl || ''
  const tableRows = Object.entries(placeholders)
    .filter(([k, v]) => !k.startsWith('_') && v !== '' && v != null && String(v).trim() !== '')
    .map(([k, v]) => `
    <tr>
      <td style="padding:8px 14px;color:#8888aa;font-size:12px;font-family:monospace;white-space:nowrap;vertical-align:top;">${humanizeKey(k)}</td>
      <td style="padding:8px 14px;color:#eeeeff;font-size:13px;font-family:monospace;vertical-align:top;">${String(v).replace(/\n/g, '<br/>')}</td>
    </tr>`).join('')

  const bodySection = bodyText ? `
        <!-- Custom message -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="color:#cccce8;font-size:14px;font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap;">${bodyText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </td>
        </tr>` : ''

  const calendarSection = calendarUrl ? `
        <!-- Add to Calendar -->
        <tr>
          <td style="padding:0 28px 24px;">
            <a href="${calendarUrl}" target="_blank"
               style="display:inline-block;background:#4338ca;color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
              &#128197; Add to Google Calendar
            </a>
          </td>
        </tr>` : ''

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
            <div style="font-size:22px;font-weight:800;color:#eeeeff;margin-top:6px;letter-spacing:1px;">${title}</div>
          </td>
        </tr>

        ${bodySection}

        <!-- Detail table -->
        <tr>
          <td style="padding:20px 28px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#111128;border:1px solid #1e1e3a;border-radius:8px;overflow:hidden;">
              ${tableRows}
            </table>
          </td>
        </tr>

        ${calendarSection}

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

export async function sendEmail({ to, cc, subject, html }) {
  const toArr = (Array.isArray(to) ? to : (to || '').split(',').map(s => s.trim())).filter(Boolean)
  const ccArr = (Array.isArray(cc) ? cc : (cc || '').split(',').map(s => s.trim())).filter(Boolean)
  if (!toArr.length) {
    console.warn('[email] No recipients — skipping.')
    return { skipped: true }
  }
  const payload = { to: toArr, subject, html }
  if (ccArr.length) payload.cc = ccArr

  const { error } = await supabase.functions.invoke('send-email', { body: payload })
  if (error) {
    // error.context holds the parsed response body when Supabase wraps a non-2xx
    const detail = error.context?.error || error.context?.message || error.message || String(error)
    console.error('[email] Edge function error:', detail, error)
    return { error: detail }
  }
  return { ok: true }
}

export function buildCalendarUrl(test, terminalAddress) {
  if (!test.date || !test.time) return ''
  const pad = n => String(n).padStart(2, '0')
  const [y, m, d] = test.date.split('-')
  const [h, min] = test.time.split(':')
  const start = `${y}${m}${d}T${h}${min}00`
  const endMs = new Date(`${test.date}T${test.time}:00`).getTime() + parseInt(test.duration || 60) * 60000
  const e = new Date(endMs)
  const end = `${e.getFullYear()}${pad(e.getMonth()+1)}${pad(e.getDate())}T${pad(e.getHours())}${pad(e.getMinutes())}00`
  const details = [
    test.candidateName ? `Candidate: ${test.candidateName}` : '',
    test.fedexId       ? `FedEx ID: ${test.fedexId}`        : '',
    test.phone         ? `Phone: ${test.phone}`             : '',
    test.terminal      ? `Terminal: ${test.terminal}`       : '',
  ].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     `Road Test - ${test.candidateName || 'Candidate'}`,
    dates:    `${start}/${end}`,
    details,
    location: terminalAddress || test.terminal || '',
  })
  return 'https://calendar.google.com/calendar/render?' + params.toString()
}

export async function sendModuleEmail(moduleKey, placeholders, settings, toOverride) {
  const cfg = settings?.[moduleKey]
  console.log(`[email] sendModuleEmail(${moduleKey}) cfg:`, JSON.stringify(cfg))
  if (!cfg?.enabled) return { skipped: true }
  const to = toOverride?.trim() || cfg.to?.trim()
  if (!to) return { skipped: true }
  const subject = interpolate(cfg.subject, placeholders)
  const title = MODULE_TITLES[moduleKey] || subject || 'Notification'
  const bodyText = cfg.body ? interpolate(cfg.body, placeholders) : ''
  const html = buildModuleHtml(title, placeholders, bodyText)
  try {
    return await sendEmail({ to, cc: cfg.cc, subject, html })
  } catch (err) {
    console.error('[email] sendEmail threw:', err)
    return { error: err.message || String(err) }
  }
}

