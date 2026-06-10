import { supabase } from './supabase'

const SETTINGS_ID = 'email_notifications'

export const DEFAULT_SETTINGS = {
  roadTestNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Road Test Scheduled - {{candidateName}} at {{terminal}}',
    body: 'Hello,\n\nA new road test has been scheduled at your terminal. Please review the details below and make sure you are available at the indicated time.\n\nCANDIDATE\n{{candidateName}}\nFedEx ID: {{fedexId}}\nPhone: {{phone}}\n\nROAD TEST\nTerminal: {{terminal}}\nAddress: {{terminalAddress}}\nDate: {{date}}\nTime: {{time}}\nDuration: {{duration}}\n\nPlease have the test vehicle ready and be at the terminal a few minutes before the scheduled time.\n\n— PND Logistics Management',
  },
  roadTestOutcome: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Road Test {{status}} - {{candidateName}}',
    body: '',
  },
  uniformOrderNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'New Uniform Order - {{terminal}} ({{driverCount}} driver(s))',
    body: 'A new uniform order has been submitted.\n\nTerminal: {{terminal}}\nRequested By: {{requestedBy}}\nDate: {{createdAt}}\n\nDrivers ({{driverCount}}):\n{{driverNames}}\n\nItems Summary:\n{{itemSummary}}\n\nNotes: {{notes}}',
  },
  injuryReportNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Work Injury Report - {{employeeName}} ({{terminal}})',
    body: 'A new work injury report has been filed.\n\nTerminal: {{terminal}}\nReported By: {{reportedBy}}\nDate Filed: {{createdAt}}\n\nEmployee: {{employeeName}}\nBody Part Injured: {{bodyPart}}\n\nDate of Injury: {{injuryDate}}\nTime of Injury: {{injuryTime}}\nLocation: {{injuryAddress}}\n\nDescription:\n{{description}}\n\nMedical Attention: {{medicalAttention}}\nMedical Provider: {{medicalProvider}}\n\nWill Miss Work: {{missedWork}}\nDays Missed: {{missedDays}}\n\nWitnesses: {{witnesses}}',
  },
  dotCardNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'New DOT Card - {{firstName}} {{lastName}} / {{fedexId}} ({{terminal}})',
    body: 'A new DOT card has been added.\n\nTerminal: {{terminal}}\nDate Added: {{createdAt}}\n\nDriver: {{firstName}} {{lastName}}\nFedEx ID: {{fedexId}}\nExpiration Date: {{expirationDate}}',
  },
  insuranceRequestNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Insurance Enrollment Request - {{employeeName}} ({{terminal}})',
    body: 'A new health insurance enrollment request has been submitted.\n\nTerminal: {{terminal}}\nRequested By: {{requestedBy}}\nDate: {{createdAt}}\n\nEmployee Name: {{employeeName}}\nEmployee Phone: {{employeePhone}}\nWithin 30-Day Window: {{has30Days}}\n\nNotes:\n{{notes}}',
  },
  hiringRequestNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Hiring Request - {{action}} ({{terminal}})',
    body: 'A new hiring request has been submitted.\n\nTerminal: {{terminal}}\nRequested By: {{requestedBy}}\nDate: {{createdAt}}\n\nAction: {{action}}\nDrivers Needed: {{driversNeeded}}\nUrgency: {{urgency}}\n\nReason:\n{{reason}}',
  },
  accidentReportNew: {
    enabled: false,
    to: '',
    cc: '',
    subject: 'Accident Report - {{driverName}} / {{fedexId}} ({{terminal}})',
    body: 'A new accident report has been filed.\n\nTerminal: {{terminal}}\nReported By: {{reportedBy}}\nDate Filed: {{createdAt}}\n\nDriver: {{driverName}}\nFedEx ID: {{fedexId}}\nVehicle ID: {{vehicleId}} ({{vehicleYear}} {{vehicleMake}} {{vehicleModel}})\n\nDate of Accident: {{accidentDate}}\nTime of Accident: {{accidentTime}}\nLocation: {{accidentAddress}}\n\nDescription:\n{{description}}\n\nVictim Name: {{victimName}}\nVictim Phone: {{victimPhone}}\nVictim Vehicle: {{victimYear}} {{victimMake}} {{victimModel}} {{victimColor}} — {{victimPlate}}\n\nVDER Working: {{vderWorking}}\n360 Camera Working: {{v360Working}}',
  },
}

export async function fetchEmailSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('id', SETTINGS_ID)
    .single()
  if (error) return DEFAULT_SETTINGS
  return Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS).map(k => {
      const stored = data.data?.[k] || {}
      const merged = { ...DEFAULT_SETTINGS[k], ...stored }
      if (!stored.body && DEFAULT_SETTINGS[k].body) merged.body = DEFAULT_SETTINGS[k].body
      return [k, merged]
    })
  )
}

export async function saveEmailSettings(settings) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, data: settings })
  return error
}
