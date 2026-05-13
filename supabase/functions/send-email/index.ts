const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL') || 'noreply@yourdomain.com'
const FROM_NAME     = Deno.env.get('FROM_NAME')  || 'PND Logistics Management'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { to, cc, subject, html } = await req.json()

    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not set' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Brevo expects arrays of { email } objects
    const toArr = (Array.isArray(to) ? to : [to]).filter(Boolean).map(e => ({ email: e }))
    const ccArr = (Array.isArray(cc) ? cc : [cc]).filter(Boolean).map(e => ({ email: e }))

    const payload: Record<string, unknown> = {
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          toArr,
      subject,
      htmlContent: html,
    }
    if (ccArr.length) payload.cc = ccArr

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
