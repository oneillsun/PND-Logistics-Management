import { useState, useEffect, useCallback, useRef } from "react";
import { dbLoad, dbSave } from "./src/lib/db.js";
import { login, logout, getSession, fetchUsers, createUser, updateUser } from "./src/lib/auth.js";
import { fetchTerminals, createTerminal, updateTerminal, uploadTerminalPdf } from "./src/lib/terminals.js";
import { sendEmail, buildOutcomeHtml } from "./src/lib/email.js";
import { fetchEmailSettings, saveEmailSettings, DEFAULT_SETTINGS } from "./src/lib/settings.js";
import { generateRoadTestPDF } from "./src/lib/pdfRecord.js";
import { uploadDotCardFile } from "./src/lib/dotCards.js";

const TERMINAL_DATA = {
"Fort Worth Terminal - 761":      { address: "4901 Village Creek Rd, Fort Worth TX 76119",        manager: "Alexis Rodriguez", phone: "+1 (787) 672-8847" },
"North Fort Worth Terminal - 762": { address: "2701 Texas Longhorn Way, Fort Worth, TX 76177",    manager: "Rebeca Davila",    phone: "+1 (775) 440-3156" },
"Arlington Terminal - 764":       { address: "2251 E Bardin Rd, Arlington, TX 76018",             manager: "Anthony Tapia",    phone: "+1 (920) 866-0324" },
"Irving Terminal - 752":          { address: "3215 Spur 482, Irving, TX 75062",                   manager: "Albert Ochoa",     phone: "+1 (972) 966-9619" },
"North Kentucky Terminal - 410":  { address: "11000 Toebben Dr, Independence, KY 41051",         manager: "Carson Lafavers",  phone: "+1 (469) 601-1992" },
"Savannah Terminal - 314":        { address: "135 Coleman Blvd, Savannah, GA 31408",              manager: "Jeremy Gonzalez",  phone: "+1 (786) 302-8160" },
};
const TERMINALS = Object.keys(TERMINAL_DATA);
const UNIFORM_TYPES = ["Polo Shirt","T-Shirt","Jacket","Safety Vest","Pants","Shorts","Cap / Hat","Steel-Toe Boots","Rain Gear","Winter Coat"];
const BOTTOM_TYPES  = ["Pants","Shorts"];
const BOTTOM_SIZES  = Array.from({length:13},(_,i)=>String(24+i*2));
const TOP_SIZES     = ["XS","S","M","L","XL","2XL","3XL","4XL"];
const getSizes = t => BOTTOM_TYPES.includes(t) ? BOTTOM_SIZES : TOP_SIZES;
const defSize  = t => BOTTOM_TYPES.includes(t) ? "32" : "M";
const BODY_PARTS = ["Head / Skull","Face","Eye(s)","Ear(s)","Neck","Shoulder(s)","Upper Arm","Elbow","Forearm","Wrist","Hand / Fingers","Upper Back","Lower Back","Chest / Ribs","Abdomen","Hip","Thigh","Knee","Lower Leg / Shin","Ankle","Foot / Toes","Multiple Areas","Other"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const SK = { rt:"pnd_rt_v5", uni:"pnd_uni_v5", tr:"pnd_tr_v5", inj:"pnd_inj_v5", acc:"pnd_acc_v2", hir:"pnd_hir_v1", ins:"pnd_ins_v1", dot:"pnd_dot_v1" };
const FC = {
  rt:    { h:"#2563eb", bg:"#eff6ff", bd:"#bfdbfe", tx:"#1e40af", ring:"#93c5fd", soft:"#dbeafe" },
  uni:   { h:"#7c3aed", bg:"#f5f3ff", bd:"#ddd6fe", tx:"#5b21b6", ring:"#c4b5fd", soft:"#ede9fe" },
  fleet: { h:"#0891b2", bg:"#ecfeff", bd:"#a5f3fc", tx:"#164e63", ring:"#67e8f9", soft:"#cffafe" },
  inj:   { h:"#dc2626", bg:"#fef2f2", bd:"#fecaca", tx:"#7f1d1d", ring:"#fca5a5", soft:"#fee2e2" },
  acc:   { h:"#ea580c", bg:"#fff7ed", bd:"#fed7aa", tx:"#7c2d12", ring:"#fdba74", soft:"#ffedd5" },
  hir:   { h:"#059669", bg:"#ecfdf5", bd:"#a7f3d0", tx:"#064e3b", ring:"#6ee7b7", soft:"#d1fae5" },
  ins:   { h:"#0369a1", bg:"#f0f9ff", bd:"#bae6fd", tx:"#0c4a6e", ring:"#7dd3fc", soft:"#e0f2fe" },
  dot:   { h:"#d97706", bg:"#fffbeb", bd:"#fde68a", tx:"#92400e", ring:"#fcd34d", soft:"#fef3c7" },
};
const STC = {
  Scheduled:{ bg:"#eff6ff", tx:"#1e40af", bd:"#bfdbfe" },
  Passed:   { bg:"#f0fdf4", tx:"#166534", bd:"#bbf7d0" },
  Failed:   { bg:"#fef2f2", tx:"#991b1b", bd:"#fecaca" },
  Pending:  { bg:"#fefce8", tx:"#854d0e", bd:"#fde68a" },
  Completed:{ bg:"#f5f3ff", tx:"#5b21b6", bd:"#ddd6fe" },
  Active:   { bg:"#f0fdf4", tx:"#166534", bd:"#bbf7d0" },
  Paused:   { bg:"#fef2f2", tx:"#991b1b", bd:"#fecaca" },
  Admin:    { bg:"#f5f3ff", tx:"#5b21b6", bd:"#ddd6fe" },
  BC:       { bg:"#eff6ff", tx:"#1e40af", bd:"#bfdbfe" },
  User:     { bg:"#f9fafb", tx:"#6b7280", bd:"#e5e7eb" },
};
const EXP = {
  expired:{ bg:"#fef2f2", tx:"#dc2626", bd:"#fecaca" },
  warning:{ bg:"#fefce8", tx:"#b45309", bd:"#fde68a" },
  ok:     { bg:"#f0fdf4", tx:"#16a34a", bd:"#bbf7d0" },
  none:   { bg:"#f9fafb", tx:"#9ca3af", bd:"#e5e7eb" },
};
const URGENCY = [
  { v:"low",    label:"Low",    sub:"Within 30 days", hex:"#16a34a", bg:"#f0fdf4", bd:"#bbf7d0" },
  { v:"medium", label:"Medium", sub:"Within 2 weeks", hex:"#ca8a04", bg:"#fefce8", bd:"#fde68a" },
  { v:"high",   label:"High",   sub:"Within 1 week",  hex:"#ea580c", bg:"#fff7ed", bd:"#fed7aa" },
  { v:"urgent", label:"Urgent", sub:"ASAP",            hex:"#dc2626", bg:"#fef2f2", bd:"#fecaca" },
];

// ─── Shared style helpers ──────────────────────────────────────────────────────
const INP = {width:"100%",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:"9px 12px",color:"#111827",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
// Keep IS as alias for backward compat with forms not yet migrated
const IS = INP;
function Btn(v,col){
  col=col||"#2563eb";
  if(v==="primary") return {padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:col,color:"#fff"};
  if(v==="outline") return {padding:"8px 16px",borderRadius:9,border:"1.5px solid "+col,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:"#fff",color:col};
  if(v==="ghost")   return {padding:"8px 14px",borderRadius:9,border:"1.5px solid #e5e7eb",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:"#fff",color:"#6b7280"};
  if(v==="danger")  return {padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:"#dc2626",color:"#fff"};
  if(v==="success") return {padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:"#16a34a",color:"#fff"};
  return {};
}
// Legacy B() shim used by older components
const B = (v="primary") => {
  if(v==="primary") return Btn("primary","#2563eb");
  if(v==="success") return Btn("success");
  if(v==="danger")  return Btn("danger");
  return Btn("ghost");
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function daysUntil(d){ if(!d) return null; return Math.ceil((new Date(d+"T12:00:00")-new Date())/86400000); }
function expStatus(d){ const n=daysUntil(d); if(n===null)return"none"; if(n<0)return"expired"; if(n<=30)return"warning"; return"ok"; }
function expLabel(d) { const n=daysUntil(d); if(n===null)return"-"; if(n<0)return`Expired ${Math.abs(n)}d ago`; if(n===0)return"Expires TODAY"; return`${n}d remaining`; }

function buildSms(f) {
  const t=TERMINAL_DATA[f.terminal]||{};
  const d=f.date?new Date(f.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}):"[date]";
  return "Hello "+(f.candidateName||"[Candidate]")+",\n\nYour road test has been scheduled:\n\nTerminal: "+f.terminal+"\n"+(t.address||"")+"\n\nDate: "+d+"\nTime: "+(f.time||"")+"\n\nManager: "+(t.manager||"")+"\nPhone: "+(t.phone||"")+"\n\nPlease arrive 10 min early with a valid driver's license.\n\nBRING TO YOUR ROAD TEST:\n- Driver License\n- Birth Certificate OR Social Security Card\n- Permanent Resident Card (if applicable)\n- Work Permit (if applicable)\n\nGood luck!\n- PND Logistics HR Team";
}
function buildHiringSMS(f) {
  const t=TERMINAL_DATA[f.terminal]||{};
  const u=URGENCY.find(x=>x.v===f.urgency)||URGENCY[1];
  const action=f.action==="start"?"START HIRING REQUEST":"PAUSE HIRING REQUEST";
  return action+"\n\nTerminal: "+f.terminal+"\n"+(t.address||"")
    +"\n\nRequested by: "+f.requestedBy
    +(f.action==="start"?"\nDrivers needed: "+f.driversNeeded+"\nUrgency: "+u.label+" ("+u.sub+")":"")
    +(f.reason?"\n\nReason:\n"+f.reason:"")
    +"\n\n- PND Logistics System";
}
function buildInsuranceEmail(f) {
  const t=TERMINAL_DATA[f.terminal]||{};
  const date=new Date(f.createdAt||new Date()).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const line="------------------";
  const eligible=f.has30Days==="yes"?"YES - Employee meets the eligibility requirement":"NO - Employee has not yet reached 30 days";
  const notes=f.notes?"ADDITIONAL NOTES\n"+line+"\n"+f.notes+"\n\n":"";
  const body="Dear Health Insurance Agent,\n\n"
    +"I am writing to request health insurance enrollment for one of our employees at PND Logistics.\n\n"
    +"EMPLOYEE INFORMATION\n"+line+"\n"
    +"Name: "+f.employeeName+"\nPhone: "+f.employeePhone+"\nTerminal: "+f.terminal
    +"\nLocation: "+(t.address||"")+"\nManager: "+(t.manager||f.requestedBy)+"\n\n"
    +"ELIGIBILITY\n"+line+"\n30 Days Completed: "+eligible+"\n\n"
    +notes+"REQUEST DATE\n"+line+"\n"+date+"\n\n"
    +"Please process this enrollment at your earliest convenience.\n\nBest regards,\n"+f.requestedBy;
  return { body, subject:"Health Insurance Enrollment Request - "+f.employeeName };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function Ico({n,s=16}){
  const p={width:s,height:s,style:{display:"block"}};
  if(n==="truck")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
  if(n==="clip")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
  if(n==="shirt")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>;
  if(n==="fleet")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><line x1="4" y1="8" x2="11" y2="8"/><line x1="4" y1="11" x2="9" y2="11"/></svg>;
  if(n==="medkit")  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="15" rx="2"/><path d="M10 2v4M14 2v4"/><path d="M12 11v6M9 14h6"/></svg>;
  if(n==="plus")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(n==="check")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
  if(n==="x")       return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if(n==="bell")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if(n==="refresh") return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
  if(n==="trash")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
  if(n==="sms")     return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if(n==="copy")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
  if(n==="pin")     return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
  if(n==="user")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if(n==="phone")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
  if(n==="warn")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  if(n==="dl")      return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
  if(n==="attach")  return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
  if(n==="gear")    return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if(n==="eye")     return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
  if(n==="badge")   return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 11h6M8 15h4"/></svg>;
  return null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({toasts}) {
  const colors={success:{bg:"#f0fdf4",bd:"#bbf7d0",tx:"#166534"},warn:{bg:"#fefce8",bd:"#fde68a",tx:"#854d0e"},default:{bg:"#eff6ff",bd:"#bfdbfe",tx:"#1e40af"}};
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>{const c=colors[t.type]||colors.default;return <div key={t.id} style={{background:c.bg,border:"1px solid "+c.bd,color:c.tx,padding:"10px 16px",borderRadius:10,fontSize:13,maxWidth:340,boxShadow:"0 4px 16px rgba(0,0,0,.1)",fontFamily:"inherit"}}>{t.message||t.msg}</div>;})}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.38)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:wide?760:560,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <span style={{fontSize:19,color:"#111827",fontWeight:700,fontFamily:"inherit"}}>{title}</span>
          <button onClick={onClose} style={{background:"#f3f4f6",border:"none",borderRadius:8,color:"#6b7280",width:32,height:32,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({label,children,span}) {
  return (
    <div style={{marginBottom:14,gridColumn:span?"1/-1":undefined}}>
      <label style={{display:"block",fontSize:11,color:"#6b7280",fontWeight:600,letterSpacing:.5,marginBottom:5,textTransform:"uppercase"}}>{label}</label>
      {children}
    </div>
  );
}
// Alias used by new components
const Fld = Field;

// ─── CSV export ───────────────────────────────────────────────────────────────
const CSV_COLS = {
  rt:    ["id","candidateName","phone","fedexId","dln","dlnState","terminal","date","time","duration","status","manager","notes","feedback","firstDay","completedAt","createdAt","paylocityOnboarding"],
  uni:   ["id","terminal","requestedBy","status","notes","items","createdAt","fulfilledAt"],
  fleet: ["id","terminal","truckNumber","licensePlate","regState","regExpiry","inspExpiry","vin","notes","createdAt","updatedAt"],
  inj:   ["id","terminal","employeeName","injuryDate","injuryTime","injuryAddress","description","bodyPart","medicalAttention","medicalProvider","missedWork","missedDays","witnesses","reportedBy","createdAt"],
  dot:       ["id","terminal","firstName","lastName","fedexId","expirationDate","file_url","createdAt"],
  users:     ["id","name","username","role","terminal","phone","email","fedex_id","status","created_at"],
  terminals: ["id","name","code","address","city","state","zipcode","fulladdress","status","rt_employer_name"],
};

function toCSV(rows, cols) {
  const esc = v => {
    if (v === null || v === undefined) return "";
    let s;
    if (Array.isArray(v)) s = v.map(i => `${i.qty}x ${i.type} (${i.size})`).join("; ");
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    s = s.replace(/\r\n/g, " ").replace(/\r/g, " ").replace(/\n/g, " ");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body   = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\r\n");
  return `${header}\r\n${body}`;
}

function downloadCSV(tab, data) {
  let cols = CSV_COLS[tab];
  if (!cols) {
    const keys = new Set();
    data.forEach(r => Object.keys(r).filter(k => !k.startsWith("_")).forEach(k => keys.add(k)));
    cols = [...keys];
  } else if (tab === "rt") {
    const keys = new Set(cols);
    data.forEach(r => Object.keys(r).filter(k => !k.startsWith("_")).forEach(k => keys.add(k)));
    cols = [...keys];
  }
  if (!cols.length) return;
  const csv  = "\ufeff" + toCSV(data, cols);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `pnd_${tab}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({status}) {
  const c=STC[status]||{bg:"#f3f4f6",tx:"#6b7280",bd:"#e5e7eb"};
  return <span style={{background:c.bg,color:c.tx,border:"1px solid "+c.bd,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{status}</span>;
}
// Alias for new components
const Bdg = Badge;

// ─── Terminal Info ────────────────────────────────────────────────────────────
function TInfo({tk,col}) {
  const t=TERMINAL_DATA[tk]; if(!t) return null;
  return (
    <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#374151",fontFamily:"inherit"}}>
      <div style={{fontWeight:600,color:"#111827",marginBottom:2}}>{tk}</div>
      <div>{t.address}</div>
      <div style={{marginTop:4,color:"#6b7280"}}>{t.manager} · {t.phone}</div>
    </div>
  );
}

// ─── Grid / Empty helpers ─────────────────────────────────────────────────────
function Grid({children}){return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:14}}>{children}</div>;}
function Empty({msg}){return <div style={{textAlign:"center",padding:80,color:"#9ca3af",fontSize:14}}>{msg}</div>;}

// ─── SMS Modal ────────────────────────────────────────────────────────────────
function SmsModal({test,onClose}) {
  const cc=FC.rt;
  const [copied,setCopied]=useState(false);
  const [sent,setSent]=useState(false);
  const msg=buildSms(test);
  const digits=(test.phone||"").replace(/\D/g,"");
  const openSms=()=>{window.location.href="sms:"+digits+"?body="+encodeURIComponent(msg);setSent(true);};
  const openWa=()=>{window.open("https://wa.me/"+digits+"?text="+encodeURIComponent(msg),"_blank");setSent(true);};
  const copy=()=>{
    navigator.clipboard.writeText(msg).catch(()=>{const el=document.createElement("textarea");el.value=msg;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);});
    setCopied(true);setTimeout(()=>setCopied(false),3000);
  };
  return (
    <Modal title="Send Candidate Notification" onClose={onClose} wide>
      <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:12,padding:18}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,background:"#fff",border:"1px solid "+cc.bd,borderRadius:10,padding:"10px 14px"}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:cc.h,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,color:"#fff",fontWeight:700}}>{test.candidateName?.charAt(0)||"?"}</div>
          <div><div style={{fontSize:16,color:"#111827",fontWeight:700}}>{test.candidateName}</div><div style={{fontSize:13,color:cc.h}}>{test.phone}</div></div>
          {sent&&<span style={{marginLeft:"auto",background:FC.hir.bg,border:"1px solid "+FC.hir.bd,borderRadius:6,padding:"3px 10px",fontSize:11,color:FC.hir.tx,fontWeight:600}}>Sent!</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <button onClick={openSms} style={{background:cc.h,border:"none",borderRadius:10,padding:"14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <span style={{fontSize:24}}>{"💬"}</span><span style={{fontWeight:700,fontSize:14,color:"#fff"}}>Text Message</span><span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Opens Messages app</span>
          </button>
          <button onClick={openWa} style={{background:"#25d366",border:"none",borderRadius:10,padding:"14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <span style={{fontSize:24}}>{"📱"}</span><span style={{fontWeight:700,fontSize:14,color:"#fff"}}>WhatsApp</span><span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Opens WhatsApp</span>
          </button>
        </div>
        <pre style={{margin:0,fontSize:12,color:"#374151",lineHeight:1.75,whiteSpace:"pre-wrap",background:"#fff",border:"1px solid "+cc.bd,borderRadius:8,padding:14,maxHeight:200,overflowY:"auto",fontFamily:"monospace"}}>{msg}</pre>
        <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center"}}>
          <button onClick={copy} style={{...Btn(copied?"primary":"outline",cc.h),display:"flex",alignItems:"center",gap:5}}><Ico n="copy" s={13}/>{copied?"Copied!":"Copy Text"}</button>
          <button onClick={onClose} style={{marginLeft:"auto",...Btn("ghost")}}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Road Test Form ───────────────────────────────────────────────────────────
function RTForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.rt;
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{candidateName:"",phone:"",fedexId:"",dln:"",dlnState:"",terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",date:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,time:`${pad(now.getHours())}:${pad(now.getMinutes())}`,duration:"60",notes:"",paylocityOnboarding:false});
  const [prev,setPrev]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=withSms=>{
    if(!form.candidateName||!form.phone||!form.fedexId) return alert("Please fill in Name, Phone, and FedEx ID.");
    onSave({...form,id:existing?.id||Date.now().toString(),status:existing?.status||"Scheduled",createdAt:existing?.createdAt||new Date().toISOString(),_sms:withSms});
  };
  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Candidate Full Name *"><input style={INP} value={form.candidateName} onChange={e=>set("candidateName",e.target.value)} placeholder="Jane Smith"/></Field>
      <Field label="Candidate Phone *"><input style={INP} value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
      <Field label="FedEx ID *"><input style={INP} value={form.fedexId} onChange={e=>set("fedexId",e.target.value)} placeholder="FX-000000"/></Field>
      <Field label="Candidate License Number"><input style={INP} value={form.dln||""} onChange={e=>set("dln",e.target.value)} placeholder="DLN-000000"/></Field>
      <Field label="DLN State"><select style={INP} value={form.dlnState||""} onChange={e=>set("dlnState",e.target.value)}><option value="">— Select —</option>{US_STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 14px"}}>
      <Field label="Test Date"><input style={INP} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
      <Field label="Start Time"><input style={INP} type="time" value={form.time} onChange={e=>set("time",e.target.value)}/></Field>
      <Field label="Duration (min)"><input style={INP} type="number" min="15" max="240" value={form.duration} onChange={e=>set("duration",e.target.value)}/></Field>
    </div>
    <Field label="Notes" span><textarea style={{...INP,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Additional notes..."/></Field>
    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:14,userSelect:"none"}}>
      <input type="checkbox" checked={!!form.paylocityOnboarding} onChange={e=>set("paylocityOnboarding",e.target.checked)} style={{width:16,height:16,accentColor:cc.h,cursor:"pointer"}}/>
      <span style={{fontSize:13,color:"#374151",fontWeight:500}}>Paylocity Onboarding</span>
    </label>
    {prev&&<div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:14,marginBottom:14}}><div style={{fontSize:11,color:cc.tx,fontWeight:600,marginBottom:8}}>SMS Preview</div><pre style={{margin:0,fontSize:12,color:"#374151",lineHeight:1.75,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{buildSms(form)}</pre></div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      {!existing&&<button style={Btn("outline",cc.h)} onClick={()=>setPrev(p=>!p)}>{prev?"Hide SMS":"Preview SMS"}</button>}
      <button style={Btn("primary",cc.h)} onClick={()=>doSave(!existing)}>{existing?"Update Test":"Schedule & Send SMS"}</button>
    </div>
  </>;
}

// ─── Outcome Form ─────────────────────────────────────────────────────────────
function OutcomeForm({test,onSave,onClose}) {
  const cc=FC.rt;
  const [passed,setPassed]=useState(null);
  const [firstDay,setFirstDay]=useState("");
  const [feedback,setFeedback]=useState(test.feedback||"");
  const [dln,setDln]=useState(test.dln||"");
  const [dlnState,setDlnState]=useState(test.dlnState||"");
  const save=()=>{
    if(passed===null)return alert("Select Pass or Fail.");
    if(passed&&!dln.trim())return alert("Candidate Driver License Number is required for a Passed outcome.");
    if(passed&&!dlnState)return alert("Candidate Driver License State is required for a Passed outcome.");
    onSave({...test,status:passed?"Passed":"Failed",firstDay:passed?firstDay:null,feedback,dln:passed?dln.trim():test.dln,dlnState:passed?dlnState:test.dlnState,completedAt:new Date().toISOString()});
  };
  return <>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:14,marginBottom:14}}>
      <div style={{fontSize:11,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Candidate</div>
      <div style={{fontSize:19,color:"#111827",fontWeight:700,marginTop:4}}>{test.candidateName}</div>
      <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>{test.fedexId} · {test.phone}</div>
    </div>
    <TInfo tk={test.terminal}/>
    <Field label="Road Test Result *">
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setPassed(true)}  style={{...Btn(passed===true?"primary":"ghost","#16a34a"),flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico n="check" s={14}/>PASSED</button>
        <button onClick={()=>setPassed(false)} style={{...Btn(passed===false?"danger":"ghost"),flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico n="x" s={14}/>FAILED</button>
      </div>
    </Field>
    {passed===true&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Candidate Driver License Number *"><input style={INP} value={dln} onChange={e=>setDln(e.target.value)} placeholder="DLN-000000"/></Field>
      <Field label="Candidate Driver License State *"><select style={INP} value={dlnState} onChange={e=>setDlnState(e.target.value)}><option value="">— Select —</option>{US_STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
    </div>}
    {passed===true&&<Field label="First Day of Training" span><input style={INP} type="date" value={firstDay} onChange={e=>setFirstDay(e.target.value)}/></Field>}
    <Field label="Manager Feedback"><textarea style={{...INP,height:80,resize:"vertical"}} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Observations..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn(passed===false?"danger":"primary",passed===false?"#dc2626":cc.h)} onClick={save}>Submit Outcome</button>
    </div>
  </>;
}

// ─── Road Test Card ───────────────────────────────────────────────────────────
function RTCard({test,onEdit,onOutcome,onDelete,onSms,users=[],terminals=[],onError}) {
  const cc=FC.rt;
  const start=new Date(`${test.date}T${test.time}`);
  const end=new Date(start.getTime()+parseInt(test.duration||60)*60000);
  const needsOutcome=new Date()>=end&&test.status==="Scheduled";
  const t=TERMINAL_DATA[test.terminal]||{};
  const [downloading,setDownloading]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const handleDownload=async()=>{
    setDownloading(true);
    try{
      const adminUser=users.find(u=>u.terminal===test.terminal&&u.status==="active")||null;
      const termRec=terminals.find(t=>`${t.name} - ${t.code}`===test.terminal||t.name===test.terminal)||{};
      await generateRoadTestPDF({...test,default_unit_number:termRec.default_unit_number||""},termRec,adminUser,termRec.pdf_url||null);
    }
    catch(e){onError?onError("Failed to generate PDF: "+e.message):alert("Failed to generate PDF: "+e.message);}
    finally{setDownloading(false);}
  };
  return (
    <div style={{background:"#fff",border:"1.5px solid "+(needsOutcome?cc.h:cc.bd),borderLeft:"4px solid "+(needsOutcome?cc.h:cc.h),borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      {needsOutcome&&<div style={{background:cc.soft,border:"1px solid "+cc.bd,borderRadius:7,padding:"7px 11px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}><Ico n="bell" s={13}/><span style={{fontSize:12,color:cc.tx,fontWeight:600}}>Road test ended — awaiting outcome</span></div>}
      <div onClick={()=>setExpanded(e=>!e)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:expanded?10:0,cursor:"pointer",userSelect:"none"}}>
        <div>
          <div style={{fontSize:17,fontWeight:700,color:"#111827"}}>{test.candidateName}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>FX ID: {test.fedexId}</div>
          <div style={{fontSize:12,color:cc.h,fontWeight:500,marginTop:3}}>{test.terminal}</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{new Date(test.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Badge status={test.status}/>
          <span style={{color:"#9ca3af",fontSize:12,lineHeight:1}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded&&<>
        <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
          <div>{test.phone}</div>
          <div style={{color:cc.h,fontWeight:500}}>{test.terminal}</div>
          <div style={{color:"#9ca3af",paddingLeft:12}}>{t.address}</div>
          <div>{new Date(test.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})} · {test.time}</div>
          <div>{t.manager} · {t.phone}</div>
          {test.createdBy&&<div style={{color:"#9ca3af",marginTop:2}}>Scheduled by {test.createdBy.name}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:10}}>
          <span style={{color:test.paylocityOnboarding?cc.h:"#ef4444",display:"flex",alignItems:"center"}}><Ico n={test.paylocityOnboarding?"check":"x"} s={12}/></span>
          <span style={{fontSize:11,color:test.paylocityOnboarding?cc.h:"#ef4444",fontWeight:500}}>Paylocity Onboarding</span>
          {test.dln&&<span style={{fontSize:11,color:"#9ca3af",marginLeft:10}}>DLN: {test.dln}{test.dlnState&&" ("+test.dlnState+")"}</span>}
        </div>
        {test.status==="Passed"&&<div style={{background:FC.hir.bg,border:"1px solid "+FC.hir.bd,borderRadius:7,padding:"7px 11px",marginBottom:10,fontSize:12,color:FC.hir.tx,fontWeight:600}}>PASSED{test.firstDay?" · Training: "+new Date(test.firstDay+"T12:00:00").toLocaleDateString():""}</div>}
        {test.status==="Failed"&&<div style={{background:FC.inj.bg,border:"1px solid "+FC.inj.bd,borderRadius:7,padding:"7px 11px",marginBottom:10,fontSize:12,color:FC.inj.tx,fontWeight:600}}>FAILED{test.feedback?" · "+test.feedback.slice(0,70):""}</div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
          <button onClick={e=>{e.stopPropagation();onEdit(test);}} style={Btn("ghost")}>Edit</button>
          {(test.status==="Scheduled"||test.status==="In Progress")&&<>
            <button onClick={e=>{e.stopPropagation();onSms(test);}} style={Btn("outline",cc.h)}>SMS</button>
            {needsOutcome&&<button onClick={e=>{e.stopPropagation();onOutcome(test);}} style={{...Btn("primary",cc.h),display:"flex",alignItems:"center",gap:5}}><Ico n="clip" s={12}/>Enter Outcome</button>}
          </>}
          {test.status==="Passed"&&<button onClick={e=>{e.stopPropagation();handleDownload();}} disabled={downloading} style={{...Btn("success"),display:"flex",alignItems:"center",gap:5,opacity:downloading?.6:1}}><Ico n="dl" s={12}/>{downloading?"Generating...":"Download Record"}</button>}
          <button onClick={e=>{e.stopPropagation();onDelete(test.id);}} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
        </div>
      </>}
    </div>
  );
}

// ─── Uniform Form ─────────────────────────────────────────────────────────────
function UniForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.uni;
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const newDrv=()=>({id:Date.now().toString()+Math.random(),name:"",items:[{type:UNIFORM_TYPES[0],size:defSize(UNIFORM_TYPES[0])}]});
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",requestedBy:"",drivers:[newDrv()],notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addDrv=()=>set("drivers",[...form.drivers,newDrv()]);
  const remDrv=id=>set("drivers",form.drivers.filter(d=>d.id!==id));
  const setName=(id,name)=>set("drivers",form.drivers.map(d=>d.id===id?{...d,name}:d));
  const addItem=id=>set("drivers",form.drivers.map(d=>d.id===id?{...d,items:[...d.items,{type:UNIFORM_TYPES[0],size:defSize(UNIFORM_TYPES[0])}]}:d));
  const remItem=(id,i)=>set("drivers",form.drivers.map(d=>d.id===id?{...d,items:d.items.filter((_,j)=>j!==i)}:d));
  const setItem=(id,i,k,v)=>set("drivers",form.drivers.map(d=>{if(d.id!==id)return d;const items=d.items.map((item,j)=>{if(j!==i)return item;const n={...item,[k]:v};if(k==="type")n.size=defSize(v);return n;});return{...d,items};}));
  const doSave=()=>{
    if(!form.requestedBy)return alert("Please enter the requester's name.");
    if(form.drivers.some(d=>!d.name.trim()))return alert("Fill in all driver names.");
    onSave({...form,id:existing?.id||Date.now().toString(),status:existing?.status||"Pending",createdAt:existing?.createdAt||new Date().toISOString()});
  };
  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Requested By *"><input style={INP} value={form.requestedBy} onChange={e=>set("requestedBy",e.target.value)} placeholder="Manager name"/></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <label style={{fontSize:11,color:"#6b7280",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Drivers and Items</label>
      <button onClick={addDrv} style={{...Btn("outline",cc.h),padding:"5px 12px",fontSize:12}}>+ Add Driver</button>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
      {form.drivers.map((drv,di)=>(
        <div key={drv.id} style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{background:cc.h,borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{di+1}</div>
            <input style={{...INP,flex:1}} value={drv.name} onChange={e=>setName(drv.id,e.target.value)} placeholder="Driver full name *"/>
            {form.drivers.length>1&&<button onClick={()=>remDrv(drv.id)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:14,padding:4}}>X</button>}
          </div>
          {drv.items.map((item,ii)=>(
            <div key={ii} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:6,alignItems:"center",marginBottom:6}}>
              <select style={{...INP,fontSize:13}} value={item.type} onChange={e=>setItem(drv.id,ii,"type",e.target.value)}>{UNIFORM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
              <select style={{...INP,fontSize:13}} value={item.size} onChange={e=>setItem(drv.id,ii,"size",e.target.value)}>{getSizes(item.type).map(s=><option key={s} value={s}>{BOTTOM_TYPES.includes(item.type)?"W"+s:s}</option>)}</select>
              {drv.items.length>1?<button onClick={()=>remItem(drv.id,ii)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:16,padding:2}}>-</button>:<span/>}
            </div>
          ))}
          <button onClick={()=>addItem(drv.id)} style={{marginTop:4,background:"none",border:"1px dashed "+cc.bd,color:cc.h,cursor:"pointer",padding:"5px 10px",borderRadius:6,fontSize:11,display:"flex",alignItems:"center",gap:4,width:"100%",justifyContent:"center",fontWeight:600}}>
            + Add Item for {drv.name||"Driver "+(di+1)}
          </button>
        </div>
      ))}
    </div>
    <div style={{fontSize:11,color:"#9ca3af",marginBottom:14}}>Pants and Shorts: waist sizes W24-W48. All others: XS-4XL</div>
    <Field label="Notes / Employee Names"><textarea style={{...INP,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Employee names, special requirements..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",cc.h)} onClick={doSave}>{existing?"Update Request":"Submit Order"}</button>
    </div>
  </>;
}

// ─── Uniform Card ─────────────────────────────────────────────────────────────
function UniCard({req,onEdit,onDelete,onFulfill,onView}) {
  const cc=FC.uni;
  const drivers=req.drivers||[];
  const totalItems=drivers.reduce((s,d)=>s+(d.items?.length||0),0);
  const t=TERMINAL_DATA[req.terminal]||{};
  return (
    <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div><div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{req.terminal}</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>By: {req.requestedBy}</div></div>
        <Badge status={req.status}/>
      </div>
      {t.address&&<div style={{fontSize:11,color:"#9ca3af",marginBottom:10}}>{t.address}</div>}
      <div style={{background:cc.bg,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
        {drivers.slice(0,3).map((drv,di)=>(
          <div key={di} style={{marginBottom:di<Math.min(drivers.length,3)-1?10:0,paddingBottom:di<Math.min(drivers.length,3)-1?10:0,borderBottom:di<Math.min(drivers.length,3)-1?"1px solid "+cc.bd:"none"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:3}}>{drv.name}</div>
            {drv.items?.map((item,ii)=><div key={ii} style={{fontSize:12,color:"#6b7280",paddingLeft:8,lineHeight:1.8}}>{item.type} <span style={{color:cc.h,fontWeight:600}}>{BOTTOM_TYPES.includes(item.type)?"W"+item.size:item.size}</span></div>)}
          </div>
        ))}
        {drivers.length>3&&<div style={{fontSize:11,color:cc.h,fontWeight:600,marginTop:8}}>+{drivers.length-3} more drivers</div>}
        <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+cc.bd,display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af"}}>
          <span>{drivers.length} driver{drivers.length!==1?"s":""}</span><span>{totalItems} items</span>
        </div>
      </div>
      <div style={{fontSize:10,color:"#9ca3af",marginBottom:8}}>Submitted {new Date(req.createdAt).toLocaleDateString()}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
        {req.status==="Pending"&&<><button onClick={()=>onEdit(req)} style={Btn("ghost")}>Edit</button><button onClick={()=>onFulfill(req.id)} style={Btn("primary","#16a34a")}>Fulfilled</button></>}
        {onView&&<button onClick={()=>onView(req)} style={Btn("outline",cc.h)}>View Order</button>}
        <button onClick={()=>onDelete(req.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Expiry Pill ──────────────────────────────────────────────────────────────
function ExpPill({label,dateStr}) {
  const s=expStatus(dateStr); const c=EXP[s];
  return (
    <div style={{background:c.bg,border:"1px solid "+c.bd,borderRadius:8,padding:"8px 12px",flex:1}}>
      <div style={{fontSize:10,color:c.tx,fontWeight:600,textTransform:"uppercase",opacity:.9,marginBottom:3}}>{label}</div>
      <div style={{fontSize:12,color:"#111827",marginBottom:2}}>{dateStr?new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"Not set"}</div>
      <div style={{fontSize:11,color:c.tx,fontWeight:600}}>{expLabel(dateStr)}</div>
    </div>
  );
}

// ─── Truck Form ───────────────────────────────────────────────────────────────
function TruckForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.fleet;
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",truckNumber:"",licensePlate:"",regState:"",regExpiry:"",inspExpiry:"",vin:"",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=()=>{if(!form.truckNumber||!form.licensePlate)return alert("Please fill in Truck # and License Plate.");onSave({...form,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});};
  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Truck / Unit # *"><input style={INP} value={form.truckNumber} onChange={e=>set("truckNumber",e.target.value)} placeholder="e.g. T-101"/></Field>
      <Field label="License Plate *"><input style={INP} value={form.licensePlate} onChange={e=>set("licensePlate",e.target.value)} placeholder="e.g. ABC-1234"/></Field>
      <Field label="Registration State"><input style={INP} value={form.regState} onChange={e=>set("regState",e.target.value)} placeholder="TX, KY, GA..." maxLength={2}/></Field>
      <Field label="Registration Expiration"><input style={INP} type="date" value={form.regExpiry} onChange={e=>set("regExpiry",e.target.value)}/></Field>
      <Field label="State Inspection Expiration"><input style={INP} type="date" value={form.inspExpiry} onChange={e=>set("inspExpiry",e.target.value)}/></Field>
      <Field label="VIN (optional)"><input style={INP} value={form.vin} onChange={e=>set("vin",e.target.value)} placeholder="Vehicle Identification Number"/></Field>
    </div>
    <Field label="Notes"><textarea style={{...INP,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any additional info..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",cc.h)} onClick={doSave}>{existing?"Update Truck":"Add Truck"}</button>
    </div>
  </>;
}

// ─── Truck Card ───────────────────────────────────────────────────────────────
function TruckCard({truck,onEdit,onDelete}) {
  const cc=FC.fleet;
  const rs=expStatus(truck.regExpiry),is=expStatus(truck.inspExpiry);
  const hasAlert=rs==="expired"||rs==="warning"||is==="expired"||is==="warning";
  const isExp=rs==="expired"||is==="expired";
  const t=TERMINAL_DATA[truck.terminal]||{};
  return (
    <div style={{background:"#fff",border:"1.5px solid "+(hasAlert?(isExp?EXP.expired.bd:EXP.warning.bd):cc.bd),borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      {hasAlert&&<div style={{background:isExp?EXP.expired.bg:EXP.warning.bg,border:"1px solid "+(isExp?EXP.expired.bd:EXP.warning.bd),borderRadius:8,padding:"7px 11px",marginBottom:12,fontSize:12,color:isExp?EXP.expired.tx:EXP.warning.tx,fontWeight:600}}>{isExp?"EXPIRED - action required":"Expiring within 30 days"}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div><div style={{fontSize:18,fontWeight:800,color:"#111827"}}>Truck {truck.truckNumber}</div><div style={{fontSize:12,color:cc.h,marginTop:2}}>{truck.terminal}</div><div style={{fontSize:11,color:"#9ca3af"}}>{t.address}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:15,color:"#111827",fontWeight:700}}>{truck.licensePlate}</div>{truck.regState&&<div style={{fontSize:11,color:"#9ca3af"}}>State: {truck.regState.toUpperCase()}</div>}</div>
      </div>
      {truck.vin&&<div style={{fontSize:11,color:"#9ca3af",marginBottom:10}}>VIN: {truck.vin}</div>}
      <div style={{display:"flex",gap:8,marginBottom:10}}><ExpPill label="Registration" dateStr={truck.regExpiry}/><ExpPill label="Inspection" dateStr={truck.inspExpiry}/></div>
      <div style={{fontSize:11,color:"#9ca3af",marginBottom:8}}>{t.manager} · {t.phone}</div>
      {truck.notes&&<div style={{fontSize:11,color:"#6b7280",marginBottom:8,fontStyle:"italic"}}>{truck.notes}</div>}
      <div style={{display:"flex",gap:6,paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
        <button onClick={()=>onEdit(truck)} style={Btn("ghost")}>Edit</button>
        <button onClick={()=>onDelete(truck.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Injury Form ──────────────────────────────────────────────────────────────
function InjuryForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.inj;
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",employeeName:"",injuryDate:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,injuryTime:`${pad(now.getHours())}:${pad(now.getMinutes())}`,injuryAddress:"",description:"",bodyPart:BODY_PARTS[0],medicalAttention:"",medicalProvider:"",missedWork:"",missedDays:"",witnesses:"",reportedBy:""});
  const [attachments,setAttachments]=useState(existing?.attachments||[]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const fmtSize=b=>b>1048576?`${(b/1048576).toFixed(1)}MB`:`${(b/1024).toFixed(0)}KB`;
  const handleFiles=e=>{Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=ev=>setAttachments(p=>[...p,{id:Date.now()+Math.random(),name:file.name,type:file.type,size:file.size,data:ev.target.result}]);r.readAsDataURL(file);});};
  const doSave=()=>{if(!form.employeeName)return alert("Please fill in Employee Name.");onSave({...form,attachments,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString(),subject:`WORK RELATED INJURY - ${form.employeeName.toUpperCase()}`});};
  return <>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"10px 14px",marginBottom:16}}>
      <div style={{fontSize:10,color:cc.tx,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:2}}>Work Related Injury Report</div>
      <div style={{fontSize:14,color:cc.tx,fontWeight:700}}>{"WORK RELATED INJURY - "+(form.employeeName?form.employeeName.toUpperCase():"[EMPLOYEE NAME]")}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Reported By (Manager)"><input style={INP} value={form.reportedBy} onChange={e=>set("reportedBy",e.target.value)} placeholder="Manager name"/></Field>
      <Field label="Employee Full Name *"><input style={INP} value={form.employeeName} onChange={e=>set("employeeName",e.target.value)} placeholder="First and Last Name"/></Field>
      <Field label="Body Part Injured"><select style={INP} value={form.bodyPart} onChange={e=>set("bodyPart",e.target.value)}>{BODY_PARTS.map(b=><option key={b} value={b}>{b}</option>)}</select></Field>
      <Field label="Date of Injury"><input style={INP} type="date" value={form.injuryDate} onChange={e=>set("injuryDate",e.target.value)}/></Field>
      <Field label="Time of Injury"><input style={INP} type="time" value={form.injuryTime} onChange={e=>set("injuryTime",e.target.value)}/></Field>
    </div>
    <Field label="Address / Location of Injury" span><input style={INP} value={form.injuryAddress} onChange={e=>set("injuryAddress",e.target.value)} placeholder="Loading dock, Warehouse aisle 3, Parking lot..."/></Field>
    <Field label="Description of What Happened" span><textarea style={{...INP,height:90,resize:"vertical"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe the incident in detail..."/></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Medical Attention Received?">
        <select style={INP} value={form.medicalAttention} onChange={e=>set("medicalAttention",e.target.value)}>
          <option value="">— Select —</option>
          <option>No</option>
          <option value="Yes - On-site first aid">Yes - On-site first aid</option>
          <option value="Yes - Urgent care clinic">Yes - Urgent care clinic</option>
          <option value="Yes - Emergency room">Yes - Emergency room</option>
          <option value="Yes - Personal doctor">Yes - Personal doctor</option>
          <option value="Yes - Other">Yes - Other</option>
        </select>
      </Field>
      {form.medicalAttention&&form.medicalAttention!=="No"&&<Field label="Name / Location of Medical Provider"><input style={INP} value={form.medicalProvider} onChange={e=>set("medicalProvider",e.target.value)} placeholder="Clinic or doctor name and address"/></Field>}
      <Field label="Will Employee Miss Work?">
        <select style={INP} value={form.missedWork} onChange={e=>set("missedWork",e.target.value)}>
          <option value="">— Select —</option>
          <option value="No">No - returning same day</option>
          <option value="Unknown">Unknown - to be determined</option>
          <option value="Yes">Yes - missed or expected to miss work</option>
        </select>
      </Field>
      {form.missedWork==="Yes"&&<Field label="Days Missed (or Expected)"><input style={INP} type="number" min="1" value={form.missedDays} onChange={e=>set("missedDays",e.target.value)} placeholder="e.g. 3"/></Field>}
    </div>
    <Field label="Witnesses (Names or None)" span><textarea style={{...INP,height:60,resize:"vertical"}} value={form.witnesses} onChange={e=>set("witnesses",e.target.value)} placeholder="List witness names, or write 'None'..."/></Field>
    <div style={{marginBottom:14}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#f9fafb",border:"2px dashed #e5e7eb",borderRadius:8,padding:"12px 16px",marginBottom:8}}>
        <Ico n="attach" s={16}/><span style={{fontSize:13,color:"#9ca3af"}}>Click to attach files (images, PDFs, videos)</span>
        <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFiles} style={{display:"none"}}/>
      </label>
      {attachments.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {attachments.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:6,padding:"8px 12px"}}>
            <span style={{fontSize:18}}>{a.type.startsWith("image")?"[img]":a.type.startsWith("video")?"[vid]":"[doc]"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:"#9ca3af"}}>{fmtSize(a.size)}</div>
            </div>
            {a.type.startsWith("image")&&<img src={a.data} alt={a.name} style={{width:40,height:40,objectFit:"cover",borderRadius:4,border:"1px solid #e5e7eb"}}/>}
            <button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",padding:4,display:"flex"}}><Ico n="x" s={13}/></button>
          </div>
        ))}
      </div>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={{...Btn("danger"),display:"flex",alignItems:"center",gap:6}} onClick={doSave}><Ico n="medkit" s={14}/>{existing?"Update Report":"Submit Injury Report"}</button>
    </div>
  </>;
}

// ─── Injury Card ──────────────────────────────────────────────────────────────
function InjuryCard({report,onView,onEdit,onDelete}) {
  const cc=FC.inj; const t=TERMINAL_DATA[report.terminal]||{};
  return (
    <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"8px 12px",marginBottom:12}}>
        <div style={{fontSize:10,color:cc.tx,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:2}}>Work Related Injury</div>
        <div style={{fontSize:15,fontWeight:700,color:cc.tx}}>{report.employeeName}</div>
      </div>
      <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
        <div style={{color:cc.h,fontWeight:500}}>{report.terminal}</div>
        <div>{report.injuryDate?new Date(report.injuryDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}):""}{report.injuryTime?" - "+report.injuryTime:""}</div>
        <div>Body: <span style={{color:cc.h,fontWeight:600}}>{report.bodyPart}</span></div>
        {report.medicalAttention&&<div>Medical: {report.medicalAttention}</div>}
        {report.missedWork==="Yes"&&<span style={{background:"#fefce8",color:"#854d0e",border:"1px solid #fde68a",borderRadius:99,padding:"2px 9px",fontSize:11,fontWeight:600,alignSelf:"flex-start"}}>Missed {report.missedDays||"?"} day(s)</span>}
      </div>
      {report.description&&<div style={{background:"#f9fafb",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#6b7280",lineHeight:1.6}}>{report.description.length>120?report.description.slice(0,120)+"...":report.description}</div>}
      {report.attachments?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {report.attachments.slice(0,4).map((a,i)=>a.type.startsWith("image")?<img key={i} src={a.data} alt={a.name} style={{width:48,height:48,objectFit:"cover",borderRadius:6,border:"1px solid #e5e7eb"}}/>:<div key={i} style={{width:48,height:48,background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#6b7280"}}>{a.type.startsWith("video")?"vid":"doc"}</div>)}
      </div>}
      <div style={{fontSize:10,color:"#9ca3af",marginBottom:8}}>Filed {new Date(report.createdAt).toLocaleDateString()} - {report.reportedBy||t.manager}</div>
      <div style={{display:"flex",gap:6,paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
        <button onClick={()=>onView(report)} style={Btn("outline",cc.h)}>View Full</button>
        <button onClick={()=>onEdit(report)} style={Btn("ghost")}>Edit</button>
        <button onClick={()=>onDelete(report.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Injury Detail ────────────────────────────────────────────────────────────
function InjuryDetail({report,onClose}) {
  const cc=FC.inj; const t=TERMINAL_DATA[report.terminal]||{}; const [lb,setLb]=useState(null);
  const Row=({label,value})=>value?<div style={{marginBottom:12}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,letterSpacing:.5,textTransform:"uppercase",marginBottom:3}}>{label}</div><div style={{fontSize:14,color:"#374151",lineHeight:1.6}}>{value}</div></div>:null;
  return (
    <Modal title="Full Injury Report" onClose={onClose} wide>
      <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 16px",marginBottom:18}}><div style={{fontSize:10,color:cc.tx,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Work Related Injury</div><div style={{fontSize:17,fontWeight:700,color:cc.tx}}>{report.employeeName?.toUpperCase()}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
        <Row label="Terminal" value={report.terminal}/><Row label="Reported By" value={report.reportedBy||t.manager}/>
        <Row label="Employee" value={report.employeeName}/><Row label="Body Part" value={report.bodyPart}/>
        <Row label="Date" value={report.injuryDate?new Date(report.injuryDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}):null}/><Row label="Time" value={report.injuryTime}/>
      </div>
      <Row label="Location" value={report.injuryAddress}/>
      <div style={{marginBottom:16}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Description</div><div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#374151",lineHeight:1.75}}>{report.description||"--"}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
        <Row label="Medical Attention" value={report.medicalAttention||"Not specified"}/>
        {report.medicalProvider&&<Row label="Medical Provider" value={report.medicalProvider}/>}
        <Row label="Missed Work" value={report.missedWork||"Not specified"}/>
        {report.missedDays&&<Row label="Days Missed" value={report.missedDays+" day(s)"}/>}
      </div>
      <Row label="Witnesses" value={report.witnesses||"None reported"}/>
      {report.attachments?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>Attachments</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{report.attachments.map((a,i)=>a.type.startsWith("image")?<img key={i} src={a.data} alt="" onClick={()=>setLb(a)} style={{width:80,height:80,objectFit:"cover",borderRadius:6,border:"1px solid #e5e7eb",cursor:"pointer"}}/>:<a key={i} href={a.data} download={a.name} style={{background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",textDecoration:"none",fontSize:12,color:"#374151"}}>{a.name}</a>)}</div></div>}
      {lb&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLb(null)}><img src={lb.data} alt="" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:8}}/><button onClick={()=>setLb(null)} style={{position:"absolute",top:20,right:20,background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:28}}>x</button></div>}
    </Modal>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const doLogin = async () => {
    if (!username || !password) return setError("Please enter your username and password.");
    setLoading(true); setError("");
    const user = await login(username, password);
    setLoading(false);
    if (!user) return setError("Invalid credentials or account is inactive.");
    onLogin(user);
  };

  const onKey = e => { if (e.key === "Enter") doLogin(); };

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(15,23,42,0.6)",backdropFilter:"blur(8px)"}}>
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:18,padding:"40px 36px",width:"100%",maxWidth:400,boxShadow:"0 24px 80px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:32}}>
          <div style={{background:"#111827",borderRadius:12,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:20,flexShrink:0}}>P</div>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:"#111827",letterSpacing:-.3,lineHeight:1}}>PND Logistics</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2,fontWeight:500}}>Management Portal</div>
          </div>
        </div>
        <Field label="Username">
          <input style={INP} value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={onKey} placeholder="Enter your username" autoFocus/>
        </Field>
        <Field label="Password">
          <input style={INP} type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKey} placeholder="Enter your password"/>
        </Field>
        {error&&<div style={{color:"#dc2626",fontSize:12,marginBottom:14,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,padding:"9px 12px"}}>{error}</div>}
        <button onClick={doLogin} disabled={loading} style={{...Btn("primary","#111827"),width:"100%",marginTop:4,fontSize:15,padding:"12px 18px",opacity:loading?.65:1}}>
          {loading?"Signing in...":"Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── User Form (admin) ────────────────────────────────────────────────────────
function UserForm({ onSave, onClose, existing, allUsers, terminals=[] }) {
  const isAdminUser = existing?.username === "admin";
  const [form, setForm] = useState(existing ? {
    name: existing.name, username: existing.username, password: "",
    role: existing.role, terminal: existing.terminal||"",
    phone: existing.phone||"", email: existing.email||"",
    fedexId: existing.fedex_id||"", status: existing.status,
  } : { name:"", username:"", password:"", role:"user", terminal:"", phone:"", email:"", fedexId:"", status:"active" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const doSave = () => {
    if (!form.name||!form.username) return alert("Name and username are required.");
    if (!existing && !form.password) return alert("Password is required for new users.");
    if (form.role==="bc" && !form.terminal) return alert("Terminal Location is required for BC role.");
    if (form.status === "active" && form.terminal) {
      const conflict = (allUsers||[]).find(u => u.terminal===form.terminal && u.status==="active" && u.id!==existing?.id);
      if (conflict) return alert(`Terminal already has an active user: ${conflict.name}.\nDeactivate that user before assigning another one to this terminal.`);
    }
    onSave(form);
  };

  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Full Name *"><input style={INP} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Jane Smith"/></Field>
      <Field label="Username *"><input style={INP} value={form.username} onChange={e=>set("username",e.target.value)} placeholder="jsmith" disabled={isAdminUser}/></Field>
      <Field label={existing?"New Password (blank = keep current)":"Password *"}>
        <input style={INP} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder={existing?"Leave blank to keep current":"Set a password"}/>
      </Field>
      <Field label="FedEx ID"><input style={INP} value={form.fedexId} onChange={e=>set("fedexId",e.target.value)} placeholder="FX-000000"/></Field>
      <Field label="Terminal Location">
        <select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)} disabled={form.role==="admin"}>
          <option value="">— Not assigned —</option>
          {terminals.filter(t=>(t.status||"Active")==="Active").map(t=>{
            const label=`${t.name} - ${t.code}`;
            const occupied=(allUsers||[]).find(u=>u.terminal===label&&u.status==="active"&&u.id!==existing?.id);
            return <option key={t.id} value={label}>{label}{occupied?" (active: "+occupied.name+")":""}</option>;
          })}
        </select>
      </Field>
      <Field label="Role">
        <select style={INP} value={form.role} onChange={e=>{set("role",e.target.value);if(e.target.value==="admin")set("terminal","");}} disabled={isAdminUser}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="bc">BC</option>
        </select>
      </Field>
      <Field label="Status">
        <select style={INP} value={form.status} onChange={e=>set("status",e.target.value)} disabled={isAdminUser}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>
      <Field label="Email"><input style={INP} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="jane@example.com"/></Field>
      <Field label="Phone Number"><input style={INP} value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
    </div>
    {isAdminUser&&<div style={{fontSize:11,color:"#854d0e",marginBottom:12,background:"#fefce8",border:"1px solid #fde68a",borderRadius:6,padding:"8px 12px"}}>Master admin account - username, role and status cannot be changed.</div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary")} onClick={doSave}>{existing?"Update User":"Create User"}</button>
    </div>
  </>;
}

// ─── User Card (admin) ────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <button onClick={copy} title="Copy" style={{background:"none",border:"none",padding:"0 4px",cursor:"pointer",color:copied?"#16a34a":"#9ca3af",fontSize:11,lineHeight:1}}>
      {copied ? "✓" : "⎘"}
    </button>
  );
}

function UserCard({ user, onEdit, isSelf }) {
  const isAdminUser = user.role === "admin";
  const cc = isAdminUser ? FC.ins : FC.rt;
  return (
    <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:17,fontWeight:700,color:"#111827"}}>{user.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:2,marginTop:2}}>
            <span style={{fontSize:11,color:"#9ca3af"}}>@{user.username}</span>
            <CopyBtn value={user.username}/>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
          <Badge status={user.role==="admin"?"Admin":user.role==="bc"?"BC":"User"}/>
          <Badge status={user.status==="active"?"Active":"Paused"}/>
        </div>
      </div>
      <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
        {user.terminal&&<div style={{color:cc.h}}>{user.terminal}</div>}
        {user.fedex_id&&<div>FedEx ID: {user.fedex_id}</div>}
        {user.email&&<div>{user.email}</div>}
        {user.phone&&<div>{user.phone}</div>}
        {isSelf&&<div style={{color:FC.hir.tx,marginTop:2,fontWeight:600}}>Currently logged in</div>}
      </div>
      <div style={{display:"flex",gap:6,paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
        <button onClick={()=>onEdit(user)} style={Btn("ghost")}>Edit</button>
      </div>
    </div>
  );
}

// ─── Terminal Form (admin) ────────────────────────────────────────────────────
function TerminalForm({onSave,onClose,existing}) {
  const [form,setForm]=useState(existing?{
    name:existing.name||"",code:existing.code||"",address:existing.address||"",
    city:existing.city||"",state:existing.state||"",
    zip:existing.zip||existing.zipcode||"",
    status:existing.status||"Active",rt_employer_name:existing.rt_employer_name||"",
    default_unit_number:existing.default_unit_number||"",
  }:{name:"",code:"",address:"",city:"",state:"",zip:"",status:"Active",rt_employer_name:"",default_unit_number:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=()=>{
    if(!form.name.trim()) return alert("Terminal Name is required.");
    onSave(form);
  };
  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Name *"><input style={INP} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Fort Worth Terminal"/></Field>
      <Field label="Terminal Code"><input style={INP} value={form.code} onChange={e=>set("code",e.target.value)} placeholder="761"/></Field>
      <Field label="Status"><select style={INP} value={form.status} onChange={e=>set("status",e.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field>
      <Field label="Address"><input style={INP} value={form.address} onChange={e=>set("address",e.target.value)} placeholder="4901 Village Creek Rd, Fort Worth TX 76119"/></Field>
      <Field label="City"><input style={INP} value={form.city} onChange={e=>set("city",e.target.value)} placeholder="Fort Worth"/></Field>
      <Field label="State"><select style={INP} value={form.state} onChange={e=>set("state",e.target.value)}><option value="">— Select —</option>{US_STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="ZIP Code"><input style={INP} value={form.zip} onChange={e=>set("zip",e.target.value)} placeholder="76119"/></Field>
    </div>
    <Field label="Road Test Employer Name" span><input style={INP} value={form.rt_employer_name} onChange={e=>set("rt_employer_name",e.target.value)} placeholder="Company LLC"/></Field>
    <Field label="Default Road Test Unit Number" span><input style={INP} value={form.default_unit_number} onChange={e=>set("default_unit_number",e.target.value)} placeholder="e.g. 4821"/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary")} onClick={doSave}>{existing?"Update Terminal":"Add Terminal"}</button>
    </div>
  </>;
}

// ─── Terminal Card (admin) ────────────────────────────────────────────────────
function TerminalCard({terminal,onEdit,onUploadPdf}) {
  const cc=FC.fleet;
  const status=terminal.status||"Active";
  const isActive=status==="Active";
  const zip=terminal.zip||terminal.zipcode||"";
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef(null);
  const handleFile=async e=>{
    const file=e.target.files?.[0];
    if(!file) return;
    if(file.type!=="application/pdf") return alert("Please select a PDF file.");
    setUploading(true);
    await onUploadPdf(terminal,file);
    setUploading(false);
    e.target.value="";
  };
  return (
    <div style={{background:"#fff",border:"1.5px solid "+(isActive?cc.bd:EXP.expired.bd),borderLeft:"4px solid "+(isActive?cc.h:EXP.expired.tx),borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:17,fontWeight:700,color:"#111827"}}>{terminal.name}</div>
          {terminal.code&&<div style={{fontSize:11,color:cc.h,marginTop:2,fontWeight:600}}>Station: {terminal.code}</div>}
        </div>
        <Badge status={isActive?"Active":"Paused"}/>
      </div>
      <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
        {terminal.address&&<div style={{color:"#374151"}}>{terminal.address}</div>}
        {(terminal.city||terminal.state||zip)&&<div style={{color:"#9ca3af"}}>{[terminal.city,terminal.state,zip].filter(Boolean).join(", ")}</div>}
        {terminal.rt_employer_name&&<div style={{color:"#9ca3af",marginTop:2}}>{terminal.rt_employer_name}</div>}
        <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:terminal.pdf_url?FC.hir.tx:"#9ca3af",fontSize:11,fontWeight:600}}>PDF: {terminal.pdf_url?terminal.pdf_url.split("/").pop():"Not set"}</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={handleFile}/>
      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
        <button onClick={()=>onEdit(terminal)} style={Btn("ghost")}>Edit</button>
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...Btn("outline",cc.h),opacity:uploading?0.6:1}}>
          {uploading?"Uploading...":terminal.pdf_url?"Re-upload Record of Road Test PDF":"Upload Record of Road Test PDF"}
        </button>
      </div>
    </div>
  );
}

// ─── Email Settings Form (admin) ──────────────────────────────────────────────
function EmailSettingsForm({moduleKey,label,placeholders,config,onChange}) {
  const set=(k,v)=>onChange(moduleKey,{...config,[k]:v});
  const isOn=config?.enabled||false;
  const [open,setOpen]=useState(false);
  return (
    <div style={{background:"#fff",border:"1px solid "+(isOn?FC.rt.bd:"#e5e7eb"),borderRadius:10,marginBottom:14,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"#9ca3af",display:"inline-block",transform:open?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s"}}>&#9654;</span>
          <span style={{fontWeight:700,fontSize:16,color:"#111827"}}>{label}</span>
        </div>
        <span style={{background:isOn?FC.hir.bg:"#f3f4f6",border:"1px solid "+(isOn?FC.hir.bd:"#e5e7eb"),borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700,color:isOn?FC.hir.tx:"#9ca3af"}}>{isOn?"Enabled":"Disabled"}</span>
      </div>
      {open&&<div style={{padding:"0 18px 18px",borderTop:"1px solid #f3f4f6"}}>
        <div style={{display:"flex",justifyContent:"flex-end",paddingTop:12,marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
            <div onClick={e=>{e.stopPropagation();set("enabled",!isOn);}} style={{width:36,height:20,borderRadius:10,background:isOn?FC.rt.h:"#e5e7eb",border:"1px solid "+(isOn?FC.rt.h:"#d1d5db"),position:"relative",transition:"background .2s",cursor:"pointer"}}>
              <div style={{position:"absolute",top:2,left:isOn?17:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
            </div>
            <span style={{fontSize:12,color:isOn?FC.hir.tx:"#9ca3af",fontWeight:600}}>{isOn?"Enabled":"Disabled"}</span>
          </label>
        </div>
        <Field label="CC (optional)"><input style={INP} value={config.cc||""} onChange={e=>set("cc",e.target.value)} placeholder="manager@company.com"/></Field>
        <Field label="Subject" span><input style={INP} value={config.subject||""} onChange={e=>set("subject",e.target.value)}/></Field>
        <Field label="Body (leave blank for auto-generated)" span><textarea style={{...INP,height:90,resize:"vertical"}} value={config.body||""} onChange={e=>set("body",e.target.value)} placeholder="Leave blank to use the default branded layout."/></Field>
        <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>
          Available placeholders: {placeholders.map(p=><span key={p} style={{marginRight:6,color:"#6b7280"}}>{"{{"+p+"}}"}</span>)}
        </div>
      </div>}
    </div>
  );
}

// ─── Accident Form ────────────────────────────────────────────────────────────
function AccidentForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.acc; const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",reportedBy:"",accidentDate:now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate()),accidentTime:pad(now.getHours())+":"+pad(now.getMinutes()),accidentAddress:"",description:"",victimName:"",victimPhone:"",victimPlate:"",victimMake:"",victimModel:"",victimColor:"",driverName:"",fedexId:"",vehicleId:"",vehicleYear:"",vehicleMake:"",vehicleModel:"",vderWorking:"",v360Working:""});
  const [photos,setPhotos]=useState(existing?.photos||[]);
  const [videos,setVideos]=useState(existing?.videos||[]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addPhotos=e=>{Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=ev=>setPhotos(p=>[...p,{id:Date.now()+Math.random(),name:file.name,type:file.type,data:ev.target.result}]);r.readAsDataURL(file);});};
  const addVideos=e=>{Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=ev=>setVideos(p=>[...p,{id:Date.now()+Math.random(),name:file.name,type:file.type,data:ev.target.result}]);r.readAsDataURL(file);});};
  const doSave=()=>{if(!form.victimName||!form.driverName||!form.fedexId)return alert("Fill Victim Name, Driver Name, and FedEx ID.");onSave({...form,photos,videos,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString()});};
  const SH=({label})=><div style={{fontSize:10,color:cc.tx,fontWeight:700,letterSpacing:1,textTransform:"uppercase",borderBottom:"2px solid "+cc.bd,paddingBottom:6,marginBottom:14,marginTop:20}}>{label}</div>;
  const YN=({field})=><div style={{display:"flex",gap:8}}>{["Yes","No"].map(opt=><button key={opt} type="button" onClick={()=>set(field,opt)} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid "+(form[field]===opt?(opt==="Yes"?"#16a34a":"#dc2626"):"#e5e7eb"),background:form[field]===opt?(opt==="Yes"?"#f0fdf4":"#fef2f2"):"#fff",color:form[field]===opt?(opt==="Yes"?"#166534":"#991b1b"):"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{opt}</button>)}</div>;
  return <div>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"10px 14px",marginBottom:16}}>
      <div style={{fontSize:10,color:cc.tx,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>Accident Report</div>
      <div style={{fontSize:15,fontWeight:700,color:cc.tx,marginTop:2}}>{form.driverName?form.driverName.toUpperCase():"[DRIVER NAME]"}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Reported By"><input style={INP} value={form.reportedBy} onChange={e=>set("reportedBy",e.target.value)} placeholder="Manager name"/></Field>
      <Field label="Date"><input style={INP} type="date" value={form.accidentDate} onChange={e=>set("accidentDate",e.target.value)}/></Field>
      <Field label="Time"><input style={INP} type="time" value={form.accidentTime} onChange={e=>set("accidentTime",e.target.value)}/></Field>
    </div>
    <Field label="Address of Accident" span><input style={INP} value={form.accidentAddress} onChange={e=>set("accidentAddress",e.target.value)} placeholder="Full address"/></Field>
    <Field label="Description" span><textarea style={{...INP,height:80,resize:"vertical"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What happened..."/></Field>
    <SH label="Victim Information"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Victim Name *"><input style={INP} value={form.victimName} onChange={e=>set("victimName",e.target.value)} placeholder="Full name"/></Field>
      <Field label="Victim Phone"><input style={INP} value={form.victimPhone} onChange={e=>set("victimPhone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
      <Field label="License Plate"><input style={INP} value={form.victimPlate} onChange={e=>set("victimPlate",e.target.value)} placeholder="ABC-1234"/></Field>
      <Field label="Color"><input style={INP} value={form.victimColor} onChange={e=>set("victimColor",e.target.value)} placeholder="White"/></Field>
      <Field label="Make"><input style={INP} value={form.victimMake} onChange={e=>set("victimMake",e.target.value)} placeholder="Toyota"/></Field>
      <Field label="Model"><input style={INP} value={form.victimModel} onChange={e=>set("victimModel",e.target.value)} placeholder="Camry"/></Field>
    </div>
    <SH label="PND Driver"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Driver Name *"><input style={INP} value={form.driverName} onChange={e=>set("driverName",e.target.value)} placeholder="Full name"/></Field>
      <Field label="FedEx ID *"><input style={INP} value={form.fedexId} onChange={e=>set("fedexId",e.target.value)} placeholder="FX-000000"/></Field>
    </div>
    <SH label="PND Vehicle"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Vehicle ID"><input style={INP} value={form.vehicleId} onChange={e=>set("vehicleId",e.target.value)} placeholder="Unit ID"/></Field>
      <Field label="Year"><input style={INP} value={form.vehicleYear} onChange={e=>set("vehicleYear",e.target.value)} placeholder="2022"/></Field>
      <Field label="Make"><input style={INP} value={form.vehicleMake} onChange={e=>set("vehicleMake",e.target.value)} placeholder="Ford"/></Field>
      <Field label="Model"><input style={INP} value={form.vehicleModel} onChange={e=>set("vehicleModel",e.target.value)} placeholder="Transit"/></Field>
      <Field label="VDER Camera Working?"><YN field="vderWorking"/></Field>
      <Field label="360 Camera Working?"><YN field="v360Working"/></Field>
    </div>
    <div style={{marginTop:16,marginBottom:14}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#f9fafb",border:"2px dashed #e5e7eb",borderRadius:8,padding:"12px 16px",marginBottom:8}}>
        <span style={{fontSize:13,color:"#9ca3af"}}>Attach Photos</span>
        <input type="file" multiple accept="image/*" onChange={addPhotos} style={{display:"none"}}/>
      </label>
      {photos.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{photos.map((a,i)=><div key={i} style={{position:"relative"}}><img src={a.data} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:6,border:"1px solid #e5e7eb"}}/><button onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-5,right:-5,background:"#dc2626",border:"none",borderRadius:"50%",width:16,height:16,color:"#fff",cursor:"pointer",fontSize:10}}>x</button></div>)}</div>}
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#f9fafb",border:"2px dashed #e5e7eb",borderRadius:8,padding:"12px 16px"}}>
        <span style={{fontSize:13,color:"#9ca3af"}}>Attach Videos</span>
        <input type="file" multiple accept="video/*" onChange={addVideos} style={{display:"none"}}/>
      </label>
      {videos.length>0&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>{videos.map((a,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f3f4f6",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#374151"}}>{a.name}<button onClick={()=>setVideos(p=>p.filter((_,j)=>j!==i))} style={{marginLeft:"auto",background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:13}}>x</button></div>)}</div>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",cc.h)} onClick={doSave}>{existing?"Update":"Submit Accident Report"}</button>
    </div>
  </div>;
}

function AccidentCard({report,onView,onEdit,onDelete}) {
  const cc=FC.acc; const t=TERMINAL_DATA[report.terminal]||{};
  return <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"8px 12px",marginBottom:12}}>
      <div style={{fontSize:10,color:cc.tx,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Accident Report</div>
      <div style={{fontSize:15,fontWeight:700,color:cc.tx}}>{report.driverName}</div>
      <div style={{fontSize:11,color:cc.ring,marginTop:1}}>FedEx: {report.fedexId}</div>
    </div>
    <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
      <div style={{color:cc.h,fontWeight:500}}>{report.terminal}</div>
      <div>{report.accidentDate?new Date(report.accidentDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}):""}{report.accidentTime?" - "+report.accidentTime:""}</div>
      {report.accidentAddress&&<div style={{color:"#9ca3af"}}>{report.accidentAddress}</div>}
      <div>Victim: <span style={{color:cc.h,fontWeight:600}}>{report.victimName}</span>{report.victimPhone?" - "+report.victimPhone:""}</div>
      {(report.victimMake||report.victimModel)&&<div>{[report.victimColor,report.victimMake,report.victimModel].filter(Boolean).join(" ")}{report.victimPlate?" ("+report.victimPlate+")":""}</div>}
    </div>
    {report.description&&<div style={{background:"#f9fafb",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#6b7280",lineHeight:1.6}}>{report.description.slice(0,110)}{report.description.length>110?"...":""}</div>}
    {report.photos?.length>0&&<div style={{display:"flex",gap:6,marginBottom:10}}>{report.photos.slice(0,4).map((a,i)=><img key={i} src={a.data} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:6,border:"1px solid #e5e7eb"}}/>)}</div>}
    <div style={{fontSize:10,color:"#9ca3af",marginBottom:10}}>Filed {new Date(report.createdAt).toLocaleDateString()} - {report.reportedBy||t.manager}</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
      <button onClick={()=>onView(report)} style={Btn("outline",cc.h)}>View Full</button>
      <button onClick={()=>onEdit(report)} style={Btn("ghost")}>Edit</button>
      <button onClick={()=>onDelete(report.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
    </div>
  </div>;
}

function AccidentDetail({report,onClose}) {
  const cc=FC.acc; const t=TERMINAL_DATA[report.terminal]||{}; const [lb,setLb]=useState(null);
  const Row=({label,value})=>value?<div style={{marginBottom:12}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{label}</div><div style={{fontSize:14,color:"#374151",lineHeight:1.6}}>{value}</div></div>:null;
  const SH=({label})=><div style={{fontSize:10,color:cc.tx,fontWeight:700,textTransform:"uppercase",borderBottom:"2px solid "+cc.bd,paddingBottom:5,marginBottom:12,marginTop:18}}>{label}</div>;
  return <Modal title="Full Accident Report" onClose={onClose} wide>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 16px",marginBottom:18}}><div style={{fontSize:10,color:cc.tx,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Accident Report</div><div style={{fontSize:17,fontWeight:700,color:cc.tx}}>Driver: {report.driverName?.toUpperCase()}</div><div style={{fontSize:12,color:cc.ring,marginTop:2}}>FedEx: {report.fedexId}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
      <Row label="Terminal" value={report.terminal}/><Row label="Reported By" value={report.reportedBy||t.manager}/>
      <Row label="Date" value={report.accidentDate?new Date(report.accidentDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}):null}/><Row label="Time" value={report.accidentTime}/>
    </div>
    <Row label="Address" value={report.accidentAddress}/>
    <div style={{marginBottom:16}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Description</div><div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#374151",lineHeight:1.75}}>{report.description||"--"}</div></div>
    <SH label="Victim"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
      <Row label="Name" value={report.victimName}/><Row label="Phone" value={report.victimPhone}/>
      <Row label="Plate" value={report.victimPlate}/><Row label="Color" value={report.victimColor}/>
      <Row label="Make" value={report.victimMake}/><Row label="Model" value={report.victimModel}/>
    </div>
    <SH label="PND Vehicle"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
      <Row label="Vehicle ID" value={report.vehicleId}/><Row label="Year" value={report.vehicleYear}/>
      <Row label="Make" value={report.vehicleMake}/><Row label="Model" value={report.vehicleModel}/>
      <Row label="VDER Camera" value={report.vderWorking&&<span style={{color:report.vderWorking==="Yes"?"#16a34a":"#dc2626",fontWeight:700}}>{report.vderWorking}</span>}/>
      <Row label="360 Camera" value={report.v360Working&&<span style={{color:report.v360Working==="Yes"?"#16a34a":"#dc2626",fontWeight:700}}>{report.v360Working}</span>}/>
    </div>
    {report.photos?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>Photos</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{report.photos.map((a,i)=><img key={i} src={a.data} alt="" onClick={()=>setLb(a)} style={{width:90,height:90,objectFit:"cover",borderRadius:6,border:"1px solid #e5e7eb",cursor:"pointer"}}/>)}</div></div>}
    {lb&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLb(null)}><img src={lb.data} alt="" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:8}}/><button onClick={()=>setLb(null)} style={{position:"absolute",top:20,right:20,background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:28}}>x</button></div>}
  </Modal>;
}

// ─── Hiring Form / Card / Notify Modal ───────────────────────────────────────
function HRNotifyModal({req,onClose}) {
  const cc=FC.hir; const [hrPhone,setHrPhone]=useState(""); const [sent,setSent]=useState(false); const [copied,setCopied]=useState(false);
  const msg=buildHiringSMS(req); const digits=hrPhone.replace(/\D/g,"");
  const openSMS=()=>{window.location.href="sms:"+digits+"?body="+encodeURIComponent(msg);setSent(true);};
  const openWA=()=>{window.open("https://wa.me/"+digits+"?text="+encodeURIComponent(msg),"_blank");setSent(true);};
  const copy=()=>{navigator.clipboard.writeText(msg).catch(()=>{const el=document.createElement("textarea");el.value=msg;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);});setCopied(true);setTimeout(()=>setCopied(false),3000);};
  const isStart=req.action==="start";
  return <Modal title="Notify HR Department" onClose={onClose} wide>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:12,padding:18}}>
      <div style={{background:"#fff",border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:isStart?cc.h:"#dc2626",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize:18}}>{isStart?"GO":"||"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{isStart?"Start Hiring Request":"Pause Hiring Request"}</div>
          <div style={{fontSize:12,color:cc.h,marginTop:1}}>{req.terminal} - by {req.requestedBy}</div>
          {isStart&&<div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>Drivers needed: {req.driversNeeded}</div>}
        </div>
        {sent&&<span style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:6,padding:"3px 10px",fontSize:11,color:cc.tx,fontWeight:600}}>Sent!</span>}
      </div>
      <Field label="HR Phone Number"><input style={{...INP,fontSize:15}} value={hrPhone} onChange={e=>setHrPhone(e.target.value)} placeholder="+1 (800) 000-0000"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <button onClick={openSMS} style={{background:isStart?cc.h:"#dc2626",border:"none",borderRadius:10,padding:"14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
          <span style={{fontSize:24}}>{"💬"}</span><span style={{fontWeight:700,fontSize:14,color:"#fff"}}>Text Message</span><span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Opens Messages app</span>
        </button>
        <button onClick={openWA} style={{background:"#25d366",border:"none",borderRadius:10,padding:"14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
          <span style={{fontSize:24}}>{"📱"}</span><span style={{fontWeight:700,fontSize:14,color:"#fff"}}>WhatsApp</span><span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Opens WhatsApp</span>
        </button>
      </div>
      <pre style={{margin:0,fontSize:12,color:"#374151",lineHeight:1.75,whiteSpace:"pre-wrap",background:"#fff",border:"1px solid "+cc.bd,borderRadius:8,padding:14,maxHeight:180,overflowY:"auto",fontFamily:"monospace"}}>{msg}</pre>
      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center"}}>
        <button onClick={copy} style={Btn(copied?"primary":"outline",cc.h)}>{copied?"Copied!":"Copy Message"}</button>
        <button onClick={onClose} style={{marginLeft:"auto",...Btn("ghost")}}>Done</button>
      </div>
    </div>
  </Modal>;
}

function HiringForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.hir;
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",requestedBy:"",action:"start",driversNeeded:"",urgency:"medium",reason:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=()=>{
    if(!form.requestedBy.trim())return alert("Enter your name.");
    if(form.action==="start"&&(!form.driversNeeded||parseInt(form.driversNeeded)<1))return alert("Enter how many drivers are needed.");
    if(!form.reason.trim())return alert("Provide a reason.");
    onSave({...form,id:existing?.id||Date.now().toString(),status:form.action==="start"?"Active":"Paused",createdAt:existing?.createdAt||new Date().toISOString(),_notify:true});
  };
  const urg=URGENCY.find(u=>u.v===form.urgency)||URGENCY[1];
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Your Name (Manager) *"><input style={INP} value={form.requestedBy} onChange={e=>set("requestedBy",e.target.value)} placeholder="Manager name"/></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <Field label="Hiring Action *">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button type="button" onClick={()=>set("action","start")} style={{display:"flex",alignItems:"center",gap:12,padding:"16px",borderRadius:12,border:"2px solid "+(form.action==="start"?cc.h:"#e5e7eb"),background:form.action==="start"?cc.bg:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          <div style={{width:40,height:40,borderRadius:10,background:form.action==="start"?cc.h:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",color:form.action==="start"?"#fff":"#374151",fontWeight:800,fontSize:14,flexShrink:0}}>GO</div>
          <div><div style={{fontWeight:700,fontSize:14,color:form.action==="start"?cc.h:"#374151"}}>Start Hiring</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Request new candidates</div></div>
        </button>
        <button type="button" onClick={()=>set("action","pause")} style={{display:"flex",alignItems:"center",gap:12,padding:"16px",borderRadius:12,border:"2px solid "+(form.action==="pause"?"#dc2626":"#e5e7eb"),background:form.action==="pause"?"#fef2f2":"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          <div style={{width:40,height:40,borderRadius:10,background:form.action==="pause"?"#dc2626":"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",color:form.action==="pause"?"#fff":"#374151",fontWeight:800,fontSize:14,flexShrink:0}}>||</div>
          <div><div style={{fontWeight:700,fontSize:14,color:form.action==="pause"?"#dc2626":"#374151"}}>Pause Hiring</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Stop accepting candidates</div></div>
        </button>
      </div>
    </Field>
    {form.action==="start"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <Field label="Drivers Needed *"><input style={INP} type="number" min="1" max="100" value={form.driversNeeded} onChange={e=>set("driversNeeded",e.target.value)} placeholder="e.g. 5"/></Field>
        <Field label="Urgency Level *"><select style={INP} value={form.urgency} onChange={e=>set("urgency",e.target.value)}>{URGENCY.map(u=><option key={u.v} value={u.v}>{u.label} - {u.sub}</option>)}</select></Field>
      </div>
      <div style={{background:urg.bg,border:"1px solid "+urg.bd,borderRadius:8,padding:"8px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <div><div style={{fontSize:12,fontWeight:700,color:urg.hex}}>{urg.label} Priority</div><div style={{fontSize:11,color:urg.hex,opacity:.8}}>{urg.sub}</div></div>
      </div>
    </>}
    <Field label={form.action==="start"?"Reason for Hiring Request *":"Reason for Pausing Hiring *"}>
      <textarea style={{...INP,height:100,resize:"vertical"}} value={form.reason} onChange={e=>set("reason",e.target.value)} placeholder={form.action==="start"?"Why are new drivers needed?...":"Why pause hiring?..."}/>
    </Field>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cc.tx,fontWeight:500}}>
      HR will receive an SMS/WhatsApp notification after submitting.
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",form.action==="start"?cc.h:"#dc2626")} onClick={doSave}>{existing?"Update":form.action==="start"?"Submit and Notify HR":"Pause and Notify HR"}</button>
    </div>
  </div>;
}

function HiringCard({req,onEdit,onDelete}) {
  const cc=FC.hir; const t=TERMINAL_DATA[req.terminal]||{}; const urg=URGENCY.find(u=>u.v===req.urgency)||URGENCY[1]; const isStart=req.action==="start";
  return <div style={{background:"#fff",border:"1.5px solid "+(isStart?cc.bd:FC.inj.bd),borderLeft:"4px solid "+(isStart?cc.h:FC.inj.h),borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
      <div>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:isStart?cc.bg:FC.inj.bg,border:"1.5px solid "+(isStart?cc.bd:FC.inj.bd),borderRadius:8,padding:"3px 10px",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:isStart?cc.h:FC.inj.h}}>{isStart?"START HIRING":"PAUSE HIRING"}</span>
        </div>
        <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{req.terminal}</div>
        <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>By: {req.requestedBy}</div>
      </div>
      <Badge status={req.status}/>
    </div>
    {t.address&&<div style={{fontSize:11,color:"#9ca3af",marginBottom:12}}>{t.address}</div>}
    {isStart&&<div style={{display:"flex",gap:10,marginBottom:12}}>
      <div style={{flex:1,background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
        <div style={{fontSize:10,color:cc.tx,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Drivers Needed</div>
        <div style={{fontSize:28,fontWeight:800,color:cc.h,lineHeight:1.1,marginTop:4}}>{req.driversNeeded}</div>
      </div>
      <div style={{flex:2,background:urg.bg,border:"1px solid "+urg.bd,borderRadius:8,padding:"10px 14px"}}>
        <div style={{fontSize:10,color:urg.hex,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Urgency</div>
        <div style={{fontSize:14,fontWeight:700,color:urg.hex,marginTop:3}}>{urg.label}</div>
        <div style={{fontSize:11,color:urg.hex,opacity:.8}}>{urg.sub}</div>
      </div>
    </div>}
    {req.reason&&<div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#374151",lineHeight:1.6}}>{req.reason.slice(0,150)}{req.reason.length>150?"...":""}</div>}
    <div style={{fontSize:10,color:"#9ca3af",marginBottom:10}}>Submitted {new Date(req.createdAt).toLocaleDateString()}</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
      <button onClick={()=>onEdit(req)} style={Btn("ghost")}>Edit</button>
      <button onClick={()=>onDelete(req.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
    </div>
  </div>;
}

// ─── Insurance Form / Card / Email Modal ─────────────────────────────────────
function InsuranceEmailModal({req,onClose}) {
  const cc=FC.ins; const [copied,setCopied]=useState(false); const [copiedSubj,setCopiedSubj]=useState(false);
  const email=buildInsuranceEmail(req);
  const copy=()=>{navigator.clipboard.writeText(email.body).catch(()=>{const el=document.createElement("textarea");el.value=email.body;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);});setCopied(true);setTimeout(()=>setCopied(false),3000);};
  const copySubj=()=>{navigator.clipboard.writeText(email.subject).catch(()=>{const el=document.createElement("textarea");el.value=email.subject;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);});setCopiedSubj(true);setTimeout(()=>setCopiedSubj(false),3000);};
  const openMail=()=>{window.location.href="mailto:?subject="+encodeURIComponent(email.subject)+"&body="+encodeURIComponent(email.body);};
  return <Modal title="Insurance Enrollment Email" onClose={onClose} wide>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:12,padding:18}}>
      <div style={{background:"#fff",border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:cc.h,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:20}}>+</div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{req.employeeName}</div>
          <div style={{fontSize:12,color:cc.h,marginTop:1}}>{req.terminal}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{req.employeePhone}</div>
        </div>
        <div style={{background:req.has30Days==="yes"?FC.hir.bg:FC.inj.bg,border:"1px solid "+(req.has30Days==="yes"?FC.hir.bd:FC.inj.bd),borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:req.has30Days==="yes"?FC.hir.tx:FC.inj.tx}}>
          {req.has30Days==="yes"?"30 Days Met":"Under 30 Days"}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:"#6b7280",fontWeight:600,textTransform:"uppercase",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Email Subject</span>
          <button onClick={copySubj} style={{...Btn(copiedSubj?"primary":"outline",cc.h),padding:"3px 10px",fontSize:11}}>{copiedSubj?"Copied!":"Copy"}</button>
        </div>
        <div style={{background:"#fff",border:"1px solid "+cc.bd,borderRadius:8,padding:"10px 14px",fontSize:13,color:"#374151",fontWeight:500,lineHeight:1.5}}>{email.subject}</div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,color:"#6b7280",fontWeight:600,textTransform:"uppercase",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Email Body</span>
          <button onClick={copy} style={{...Btn(copied?"primary":"outline",cc.h),padding:"3px 10px",fontSize:11}}>{copied?"Copied!":"Copy Body"}</button>
        </div>
        <pre style={{margin:0,fontSize:12,color:"#374151",lineHeight:1.85,whiteSpace:"pre-wrap",wordBreak:"break-word",background:"#fff",border:"1px solid "+cc.bd,borderRadius:8,padding:16,maxHeight:320,overflowY:"auto",fontFamily:"monospace"}}>{email.body}</pre>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <button onClick={openMail} style={{...Btn("primary",cc.h),display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"14px"}}>
          <span style={{fontSize:22}}>@</span>
          <span style={{fontWeight:700,fontSize:13}}>Open in Mail App</span>
          <span style={{fontSize:10,opacity:.75}}>Auto-fills subject and body</span>
        </button>
        <button onClick={copy} style={{...Btn(copied?"primary":"outline",cc.h),display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"14px"}}>
          <span style={{fontSize:22}}>{"[]"}</span>
          <span style={{fontWeight:700,fontSize:13}}>{copied?"Copied!":"Copy Full Email"}</span>
          <span style={{fontSize:10,opacity:.75}}>Paste into any email client</span>
        </button>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={onClose} style={Btn("ghost")}>Done</button>
      </div>
    </div>
  </Modal>;
}

function InsuranceForm({onSave,onClose,existing,terminals=[]}) {
  const cc=FC.ins;
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const [form,setForm]=useState(existing||{terminal:activeTerminals[0]?`${activeTerminals[0].name} - ${activeTerminals[0].code}`:"",requestedBy:"",employeeName:"",employeePhone:"",has30Days:"",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=()=>{
    if(!form.employeeName.trim())return alert("Enter employee name.");
    if(!form.employeePhone.trim())return alert("Enter employee phone number.");
    if(!form.has30Days)return alert("Please indicate whether the employee has 30 days of employment.");
    if(!form.requestedBy.trim())return alert("Enter your name.");
    onSave({...form,id:existing?.id||Date.now().toString(),status:"Pending",createdAt:existing?.createdAt||new Date().toISOString(),_email:true});
  };
  return <div>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:28}}>+</div>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:cc.tx}}>Health Insurance Enrollment Request</div>
        <div style={{fontSize:11,color:cc.ring,marginTop:1}}>Submitting will generate a ready-to-send email for the insurance agent</div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Terminal Location"><select style={INP} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Requested By (Manager) *"><input style={INP} value={form.requestedBy} onChange={e=>set("requestedBy",e.target.value)} placeholder="Your name"/></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
      <Field label="Employee Full Name *"><input style={INP} value={form.employeeName} onChange={e=>set("employeeName",e.target.value)} placeholder="First and Last Name"/></Field>
      <Field label="Employee Phone Number *"><input style={INP} value={form.employeePhone} onChange={e=>set("employeePhone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
    </div>
    <Field label="Does the employee have 30 days of employment? *">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button type="button" onClick={()=>set("has30Days","yes")} style={{display:"flex",alignItems:"center",gap:12,padding:"16px",borderRadius:12,border:"2px solid "+(form.has30Days==="yes"?cc.h:"#e5e7eb"),background:form.has30Days==="yes"?cc.bg:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          <div style={{width:38,height:38,borderRadius:10,background:form.has30Days==="yes"?cc.h:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:form.has30Days==="yes"?"#fff":"#166534",fontWeight:800,fontSize:18}}>Y</div>
          <div><div style={{fontWeight:700,fontSize:14,color:form.has30Days==="yes"?cc.h:"#166534"}}>Yes</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Employee is eligible</div></div>
        </button>
        <button type="button" onClick={()=>set("has30Days","no")} style={{display:"flex",alignItems:"center",gap:12,padding:"16px",borderRadius:12,border:"2px solid "+(form.has30Days==="no"?"#dc2626":"#e5e7eb"),background:form.has30Days==="no"?"#fef2f2":"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          <div style={{width:38,height:38,borderRadius:10,background:form.has30Days==="no"?"#dc2626":"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:form.has30Days==="no"?"#fff":"#991b1b",fontWeight:800,fontSize:18}}>N</div>
          <div><div style={{fontWeight:700,fontSize:14,color:form.has30Days==="no"?"#dc2626":"#991b1b"}}>No</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Not yet eligible</div></div>
        </button>
      </div>
    </Field>
    {form.has30Days==="no"&&<div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#854d0e",fontWeight:500}}>Note: Employee has not yet reached 30 days. The request and email will note this.</div>}
    {form.has30Days==="yes"&&<div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cc.tx,fontWeight:500}}>Employee meets the 30-day requirement for health insurance enrollment.</div>}
    <Field label="Additional Notes (optional)">
      <textarea style={{...INP,height:80,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Plan preferences, dependents, special circumstances..."/>
    </Field>
    <div style={{background:cc.bg,border:"1px solid "+cc.bd,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cc.tx,fontWeight:500}}>
      After submitting, a ready-to-send email will be generated for the insurance agent.
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",cc.h)} onClick={doSave}>{existing?"Update Request":"Submit and Generate Email"}</button>
    </div>
  </div>;
}

function InsuranceCard({req,onEdit,onDelete,onEmail}) {
  const cc=FC.ins; const t=TERMINAL_DATA[req.terminal]||{};
  return <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:40,height:40,borderRadius:10,background:cc.bg,border:"1px solid "+cc.bd,display:"flex",alignItems:"center",justifyContent:"center",color:cc.h,fontWeight:800,fontSize:18,flexShrink:0}}>+</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{req.employeeName}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{req.employeePhone}</div>
        </div>
      </div>
      <span style={{background:req.has30Days==="yes"?FC.hir.bg:FC.inj.bg,border:"1px solid "+(req.has30Days==="yes"?FC.hir.bd:FC.inj.bd),borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,color:req.has30Days==="yes"?FC.hir.tx:FC.inj.tx,whiteSpace:"nowrap"}}>
        {req.has30Days==="yes"?"30 Days Met":"Under 30 Days"}
      </span>
    </div>
    <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
      <div style={{color:cc.h,fontWeight:500}}>{req.terminal}</div>
      {t.address&&<div style={{color:"#9ca3af",paddingLeft:12}}>{t.address}</div>}
      <div>Requested by: {req.requestedBy}</div>
    </div>
    {req.notes&&<div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#374151",lineHeight:1.6,fontStyle:"italic"}}>{req.notes.slice(0,120)}{req.notes.length>120?"...":""}</div>}
    <div style={{fontSize:10,color:"#9ca3af",marginBottom:10}}>Submitted {new Date(req.createdAt).toLocaleDateString()}</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
      <button onClick={()=>onEdit(req)} style={Btn("ghost")}>Edit</button>
      <button onClick={()=>onEmail(req)} style={Btn("primary",cc.h)}>View Email</button>
      <button onClick={()=>onDelete(req.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
    </div>
  </div>;
}

// ─── DOT Card Form ────────────────────────────────────────────────────────────
function DOTCardForm({onSave,onClose,existing,terminals=[]}) {
  const activeTerminals=terminals.filter(t=>(t.status||"Active")==="Active");
  const initId=existing?.terminal_id||activeTerminals.find(t=>`${t.name} - ${t.code}`===existing?.terminal)?.id||activeTerminals[0]?.id||"";
  const initLabel=t=>`${t.name} - ${t.code}`;
  const initTerminal=activeTerminals.find(t=>t.id===initId)?initLabel(activeTerminals.find(t=>t.id===initId)):existing?.terminal||"";
  const [form,setForm]=useState({terminal_id:initId,terminal:initTerminal,firstName:existing?.firstName||"",lastName:existing?.lastName||"",fedexId:existing?.fedexId||"",expirationDate:existing?.expirationDate||""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleTerminal=e=>{const t=activeTerminals.find(x=>x.id===e.target.value);setForm(f=>({...f,terminal_id:e.target.value,terminal:t?`${t.name} - ${t.code}`:""}));};
  const doSave=()=>{
    if(!form.firstName.trim()||!form.lastName.trim()) return alert("Driver first and last name are required.");
    if(!form.fedexId.trim()) return alert("FedEx ID is required.");
    if(!form.expirationDate) return alert("Expiration date is required.");
    if(!form.terminal_id) return alert("Terminal is required.");
    onSave({...form,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString()});
  };
  return <>
    <div className="form-grid-2">
      <Field label="Terminal *" span><select style={INP} value={form.terminal_id} onChange={handleTerminal}>{activeTerminals.length===0&&<option value="">Loading terminals…</option>}{activeTerminals.map(t=><option key={t.id} value={t.id}>{t.name} - {t.code}</option>)}</select></Field>
      <Field label="Driver First Name *"><input style={INP} value={form.firstName} onChange={e=>set("firstName",e.target.value)} placeholder="John"/></Field>
      <Field label="Driver Last Name *"><input style={INP} value={form.lastName} onChange={e=>set("lastName",e.target.value)} placeholder="Smith"/></Field>
      <Field label="Driver FedEx ID *"><input style={INP} value={form.fedexId} onChange={e=>set("fedexId",e.target.value)} placeholder="FX-000000"/></Field>
      <Field label="Expiration Date *"><input style={INP} type="date" value={form.expirationDate} onChange={e=>set("expirationDate",e.target.value)}/></Field>
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={Btn("ghost")} onClick={onClose}>Cancel</button>
      <button style={Btn("primary",FC.dot.h)} onClick={doSave}>{existing?"Update DOT Card":"Add DOT Card"}</button>
    </div>
  </>;
}

// ─── DOT Card ─────────────────────────────────────────────────────────────────
function DOTCard({card,onEdit,onDelete,onUpload}) {
  const cc=FC.dot;
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef(null);
  const handleFile=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(file.type!=="application/pdf"){
      toast("Only PDF files are allowed for DOT card uploads.","warn");
      e.target.value="";
      return;
    }
    setUploading(true);
    await onUpload(card,file);
    setUploading(false);
    e.target.value="";
  };
  const buildDownloadName=()=>{
    const ext=card.file_url?"."+card.file_url.split(".").pop().split("?")[0]:"";
    const parts=[];
    const first=card.firstName?.trim();
    const last=card.lastName?.trim();
    if(first||last) parts.push((first?first[0].toUpperCase():"")+( last||""));
    if(card.fedexId?.trim()) parts.push(card.fedexId.trim());
    if(card.expirationDate){
      const[y,m,d]=card.expirationDate.split("-");
      parts.push(`${m}${d}${y}`);
    }
    return (parts.join("_")||"DOTCard")+ext;
  };
  const handleDownload=async()=>{
    if(!card.file_url) return;
    const res=await fetch(card.file_url);
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=buildDownloadName();
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  const st=expStatus(card.expirationDate);
  const ec=EXP[st];
  const expDate=card.expirationDate?new Date(card.expirationDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"";
  return <div style={{background:"#fff",border:"1.5px solid "+cc.bd,borderLeft:"4px solid "+cc.h,borderRadius:14,padding:18,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <div>
        <div style={{fontSize:16,fontWeight:700,color:"#111827"}}>{card.firstName} {card.lastName}</div>
        <div style={{fontSize:12,color:cc.h,fontWeight:600,marginTop:2}}>{card.fedexId}</div>
      </div>
      {st!=="none"&&<span style={{background:ec.bg,border:"1px solid "+ec.bd,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,color:ec.tx,whiteSpace:"nowrap"}}>{expLabel(card.expirationDate)}</span>}
    </div>
    <div style={{fontSize:12,color:"#6b7280",display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
      <div style={{color:cc.h,fontWeight:500}}>{card.terminal}</div>
      {card.expirationDate&&<div>Expires: <span style={{fontWeight:600,color:ec.tx}}>{expDate}</span></div>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"8px 10px",background:card.file_url?"#f0fdf4":"#f9fafb",border:"1px solid "+(card.file_url?"#bbf7d0":"#e5e7eb"),borderRadius:8}}>
      <span style={{fontSize:12,color:card.file_url?"#166534":"#9ca3af",fontWeight:600}}>{card.file_url?"Card file: "+(card.file_name||card.file_url.split("/").pop()):"No card file uploaded"}</span>
    </div>
    <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={handleFile}/>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f3f4f6"}}>
      <button onClick={()=>onEdit(card)} style={Btn("ghost")}>Edit</button>
      <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...Btn("outline",cc.h),opacity:uploading?0.6:1}}>
        {uploading?"Uploading…":card.file_url?"Re-upload Card":"Upload Card"}
      </button>
      {card.file_url&&<button onClick={handleDownload} style={{...Btn("ghost"),display:"flex",alignItems:"center",gap:5}}><Ico n="dl" s={13}/>Download</button>}
      <button onClick={()=>onDelete(card.id)} style={{...Btn("ghost"),marginLeft:"auto",color:"#dc2626",borderColor:"#fecaca"}}><Ico n="trash" s={13}/></button>
    </div>
  </div>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [currentUser,  setCurrentUser]  = useState(null);
  const [authChecked,  setAuthChecked]  = useState(false);
  const [users,        setUsers]        = useState([]);

  useEffect(()=>{ setCurrentUser(getSession()); setAuthChecked(true); },[]);

  const handleLogin  = useCallback(user => { setCurrentUser(user); if(user?.role!=="admin") setTab(t=>t==="settings"?"rt":t); }, []);
  const handleLogout = useCallback(()=>{ logout(); setCurrentUser(null); setTab("rt"); },[]);

  const loadUsers = useCallback(async()=>{
    const data = await fetchUsers();
    setUsers(data);
  },[]);

  const [terminals,setTerminals]=useState([]);
  const loadTerminals=useCallback(async()=>{
    const data=await fetchTerminals();
    setTerminals(data);
  },[]);

  const [emailSettings,setEmailSettings]=useState(DEFAULT_SETTINGS);
  const loadSettings=useCallback(async()=>{
    setEmailSettings(await fetchEmailSettings());
  },[]);

  useEffect(()=>{
    if(!currentUser) return;
    loadTerminals();
    if(currentUser.role==="admin"){ loadUsers(); loadSettings(); }
  },[currentUser,loadUsers,loadTerminals,loadSettings]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tab,setTab]=useState("rt");
  const [rts,setRts]=useState([]);
  const [unis,setUnis]=useState([]);
  const [trucks,setTrucks]=useState([]);
  const [injs,setInjs]=useState([]);
  const [accs,setAccs]=useState([]);
  const [hirs,setHirs]=useState([]);
  const [insrs,setInsrs]=useState([]);
  const [dots,setDots]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [toasts,setToasts]=useState([]);
  const [fTerm,setFTerm]=useState("All");
  const [fStatus,setFStatus]=useState("Scheduled");
  const [fDateFrom,setFDateFrom]=useState("");
  const [fDateTo,setFDateTo]=useState("");
  const [fTerminalStatus,setFTerminalStatus]=useState("Active");
  const [settingsTab,setSettingsTab]=useState("terminals");
  const [lastSync,setLastSync]=useState(null);
  const [syncing,setSyncing]=useState(false);

  const toast=useCallback((msg,type="info")=>{const id=Date.now();setToasts(t=>[...t,{id,message:msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);},[]);

  const loadAll=useCallback(async()=>{
    const [a,b,c,d,e,f,g,h]=await Promise.all([dbLoad(SK.rt),dbLoad(SK.uni),dbLoad(SK.tr),dbLoad(SK.inj),dbLoad(SK.acc),dbLoad(SK.hir),dbLoad(SK.ins),dbLoad(SK.dot)]);
    setRts(a);setUnis(b);setTrucks(c);setInjs(d);setAccs(e);setHirs(f);setInsrs(g);setDots(h);setLastSync(new Date());setLoading(false);
  },[]);

  const handleSync=useCallback(async()=>{
    if(syncing) return;
    setSyncing(true);
    await loadAll();
    setSyncing(false);
    toast("Data refreshed from Supabase.","success");
  },[syncing,loadAll,toast]);

  // Only start polling after auth is confirmed
  useEffect(()=>{
    if(!currentUser) return;
    loadAll();
    const iv=setInterval(loadAll,15000);
    return()=>clearInterval(iv);
  },[currentUser,loadAll]);

  const saveRT=async test=>{
    const isNew=!rts.some(r=>r.id===test.id);
    const showSms=test._sms; const clean={...test}; delete clean._sms;
    if(isNew) clean.createdBy={id:currentUser.id,name:currentUser.name,email:currentUser.email||null};
    const upd=isNew?[...rts,clean]:rts.map(r=>r.id===clean.id?clean:r);
    setRts(upd);
    toast(isNew?"✅ Road test scheduled!":"Road test updated.","success");
    setModal(showSms?{type:"sms",data:clean}:null);
    dbSave(SK.rt,upd);
  };
  const delRT=async id=>{if(!confirm("Delete this road test?"))return;const upd=rts.filter(r=>r.id!==id);setRts(upd);toast("Road test removed.");dbSave(SK.rt,upd);};
  const saveOutcome=async test=>{
    const upd=rts.map(r=>r.id===test.id?test:r);
    setRts(upd);
    toast(test.status==="Passed"?"✅ Passed!":"❌ Outcome recorded.",test.status==="Passed"?"success":"warn");
    setModal(null);
    dbSave(SK.rt,upd);
    const creatorEmail=test.createdBy?.email||"";
    if(!creatorEmail){toast("📧 Email skipped — road test creator has no email on file.","warn");}
    else{
      const termRec=terminals.find(t=>`${t.name} - ${t.code}`===test.terminal||t.name===test.terminal)||{};
      const cc=emailSettings.roadTestOutcome?.cc||"";
      const subject="Road Test "+(test.status==="Passed"?"Passed":"Failed")+" - "+test.candidateName;
      const result=await sendEmail({
        to:creatorEmail,
        ...(cc&&{cc}),
        subject,
        html:buildOutcomeHtml({...test,default_unit_number:termRec.default_unit_number||""}),
      });
      if(result?.ok) toast("📧 Notification sent to "+creatorEmail+".","success");
      else if(result?.error) toast("📧 Email failed — check console.","warn");
    }
  };

  const saveUni=async req=>{const isNew=!unis.some(u=>u.id===req.id);const upd=isNew?[...unis,req]:unis.map(u=>u.id===req.id?req:u);setUnis(upd);toast("Uniform order saved!","success");setModal(null);dbSave(SK.uni,upd);};
  const delUni=async id=>{if(!confirm("Delete?"))return;const upd=unis.filter(u=>u.id!==id);setUnis(upd);toast("Removed.");dbSave(SK.uni,upd);};
  const fulfillUni=async id=>{const upd=unis.map(u=>u.id===id?{...u,status:"Completed",fulfilledAt:new Date().toISOString()}:u);setUnis(upd);toast("✅ Order fulfilled!","success");dbSave(SK.uni,upd);};

  const saveTruck=async truck=>{const isNew=!trucks.some(t=>t.id===truck.id);const upd=isNew?[...trucks,truck]:trucks.map(t=>t.id===truck.id?truck:t);setTrucks(upd);toast(isNew?"🚚 Truck added!":"Truck updated.","success");setModal(null);dbSave(SK.tr,upd);};
  const delTruck=async id=>{if(!confirm("Remove truck?"))return;const upd=trucks.filter(t=>t.id!==id);setTrucks(upd);toast("Truck removed.");dbSave(SK.tr,upd);};

  const saveInj=async r=>{const isNew=!injs.some(x=>x.id===r.id);const upd=isNew?[...injs,r]:injs.map(x=>x.id===r.id?r:x);setInjs(upd);toast(isNew?"Injury report filed.":"Report updated.","warn");setModal(null);dbSave(SK.inj,upd);};
  const delInj=async id=>{if(!confirm("Delete this injury report?"))return;const upd=injs.filter(r=>r.id!==id);setInjs(upd);toast("Report deleted.");dbSave(SK.inj,upd);};

  const saveAcc=async r=>{const isNew=!accs.some(x=>x.id===r.id);const upd=isNew?[...accs,r]:accs.map(x=>x.id===r.id?r:x);setAccs(upd);toast(isNew?"Accident report filed.":"Report updated.","warn");setModal(null);dbSave(SK.acc,upd);};
  const delAcc=async id=>{if(!confirm("Delete this accident report?"))return;const upd=accs.filter(r=>r.id!==id);setAccs(upd);toast("Report deleted.");dbSave(SK.acc,upd);};

  const saveHir=async r=>{
    const showNotify=r._notify; const clean={...r}; delete clean._notify;
    const isNew=!hirs.some(x=>x.id===clean.id);
    const upd=isNew?[...hirs,clean]:hirs.map(x=>x.id===clean.id?clean:x);
    setHirs(upd);toast(isNew?"Hiring request submitted.":"Request updated.","success");
    setModal(showNotify?{type:"hirNotify",data:clean}:null);
    dbSave(SK.hir,upd);
  };
  const delHir=async id=>{if(!confirm("Delete this hiring request?"))return;const upd=hirs.filter(r=>r.id!==id);setHirs(upd);toast("Removed.");dbSave(SK.hir,upd);};

  const saveInsr=async r=>{
    const showEmail=r._email; const clean={...r}; delete clean._email;
    const isNew=!insrs.some(x=>x.id===clean.id);
    const upd=isNew?[...insrs,clean]:insrs.map(x=>x.id===clean.id?clean:x);
    setInsrs(upd);toast(isNew?"Insurance request submitted.":"Request updated.","success");
    setModal(showEmail?{type:"insEmail",data:clean}:null);
    dbSave(SK.ins,upd);
  };
  const delInsr=async id=>{if(!confirm("Delete this insurance request?"))return;const upd=insrs.filter(r=>r.id!==id);setInsrs(upd);toast("Removed.");dbSave(SK.ins,upd);};

  const saveDot=async r=>{const isNew=!dots.some(x=>x.id===r.id);const upd=isNew?[...dots,r]:dots.map(x=>x.id===r.id?r:x);setDots(upd);toast(isNew?"DOT Card added.":"DOT Card updated.","success");setModal(null);dbSave(SK.dot,upd);};
  const delDot=async id=>{if(!confirm("Delete this DOT card record?"))return;const upd=dots.filter(r=>r.id!==id);setDots(upd);toast("Removed.");dbSave(SK.dot,upd);};
  const handleUploadDotCardFile=useCallback(async(card,file)=>{
    const{url,error}=await uploadDotCardFile(card.id,file);
    if(error) return toast("Upload failed: "+error,"warn");
    const upd=dots.map(r=>r.id===card.id?{...r,file_url:url,file_name:file.name}:r);
    setDots(upd);dbSave(SK.dot,upd);toast("Card file uploaded.","success");
  },[dots,toast]);

  const pendingOut=rts.filter(r=>{const e=new Date(`${r.date}T${r.time}`);e.setMinutes(e.getMinutes()+parseInt(r.duration||60));return new Date()>=e&&r.status==="Scheduled";}).length;
  const truckAlerts=trucks.filter(t=>(expStatus(t.regExpiry)!=="ok"&&expStatus(t.regExpiry)!=="none")||(expStatus(t.inspExpiry)!=="ok"&&expStatus(t.inspExpiry)!=="none")).length;
  const activeHiring=hirs.filter(h=>h.action==="start"&&h.status==="Active").length;

  const fRts       =rts.filter(r=>(fTerm==="All"||r.terminal===fTerm)&&(fStatus==="All"||r.status===fStatus)&&(!fDateFrom||r.date>=fDateFrom)&&(!fDateTo||r.date<=fDateTo)).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const fTerminals =terminals.filter(t=>fTerminalStatus==="All"||(t.status||"Active")===fTerminalStatus).sort((a,b)=>a.name?.localeCompare(b.name));
  const fUnis  =unis.filter(u=>fTerm==="All"||u.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fTrucks=trucks.filter(t=>fTerm==="All"||t.terminal===fTerm).sort((a,b)=>{const u=x=>{const r=expStatus(x.regExpiry),i=expStatus(x.inspExpiry);if(r==="expired"||i==="expired")return 0;if(r==="warning"||i==="warning")return 1;return 2;};return u(a)-u(b);});
  const fInjs  =injs.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fAccs  =accs.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fHirs  =hirs.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fInsrs =insrs.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fDots  =dots.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(a.expirationDate)-new Date(b.expirationDate));

  const TABS=[
    {key:"rt",    icon:"clip",   label:"Road Tests",     count:rts.filter(r=>r.status==="Scheduled").length, badgeColor:FC.rt.h},
    {key:"uni",   icon:"shirt",  label:"Uniform Orders", count:unis.filter(u=>u.status==="Pending").length,  badgeColor:FC.uni.h},
    {key:"fleet", icon:"fleet",  label:"Fleet",          count:truckAlerts,                                   badgeColor:FC.fleet.h},
    {key:"inj",   icon:"medkit", label:"Injury Reports", count:injs.length,                                   badgeColor:FC.inj.h},
    {key:"acc",   icon:"warn",   label:"Accidents",      count:accs.length,                                   badgeColor:FC.acc.h},
    {key:"hir",   icon:"user",   label:"Hiring",         count:activeHiring,                                  badgeColor:FC.hir.h},
    {key:"ins",   icon:"phone",  label:"Insurance",      count:insrs.length,                                  badgeColor:FC.ins.h},
    {key:"dot",   icon:"badge",  label:"DOT Cards",      count:dots.filter(d=>{const s=expStatus(d.expirationDate);return s==="expired"||s==="warning";}).length, badgeColor:FC.dot.h},
    ...(currentUser?.role==="admin"?[
      {key:"settings", icon:"gear", label:"Settings", count:0, badgeColor:"#6b7280"},
    ]:[]),
  ];

  const addLabel={rt:"Schedule Road Test",uni:"New Uniform Request",fleet:"Add Truck",inj:"File Injury Report",acc:"File Accident Report",hir:"New Hiring Request",ins:"New Insurance Request",dot:"+ DOT Card"};
  const addType ={rt:"newRT",uni:"newUni",fleet:"newTruck",inj:"newInj",acc:"newAcc",hir:"newHir",ins:"newIns",dot:"newDot"};

  const STATS=[
    {l:"Scheduled Tests", v:rts.filter(r=>r.status==="Scheduled").length,  c:FC.rt.h},
    {l:"Passed",          v:rts.filter(r=>r.status==="Passed").length,     c:"#16a34a"},
    {l:"Pending Orders",  v:unis.filter(u=>u.status==="Pending").length,   c:FC.uni.h},
    {l:"Fleet Alerts",    v:truckAlerts,                                    c:FC.fleet.h},
    {l:"Injury Reports",  v:injs.length,                                    c:FC.inj.h},
    {l:"Accidents",       v:accs.length,                                    c:FC.acc.h},
    {l:"Active Hiring",   v:activeHiring,                                   c:FC.hir.h},
    {l:"Insurance Reqs",  v:insrs.length,                                   c:FC.ins.h},
  ];

  // ── User save handlers (admin) ───────────────────────────────────────────────
  const handleSaveUser = useCallback(async form => {
    let error;
    if (modal?.data) {
      error = await updateUser(modal.data.id, form);
    } else {
      error = await createUser(form);
    }
    if (error) return toast(error.message || "Failed to save user.", "warn");
    await loadUsers();
    toast(modal?.data ? "User updated." : "User created.", "success");
    setModal(null);
  }, [modal, loadUsers, toast]);

  const handleSettingsChange=useCallback((moduleKey,cfg)=>{
    setEmailSettings(prev=>({...prev,[moduleKey]:cfg}));
  },[]);

  const handleSaveSettings=useCallback(async()=>{
    const error=await saveEmailSettings(emailSettings);
    if(error) toast("Failed to save settings.","warn");
    else toast("Email settings saved.","success");
  },[emailSettings,toast]);

  const handleSaveTerminal=useCallback(async form=>{
    let error;
    if(modal?.data){
      error=await updateTerminal(modal.data.id,{...modal.data,...form});
    } else {
      error=await createTerminal(form);
    }
    if(error) return toast(error.message||"Failed to save terminal.","warn");
    await loadTerminals();
    toast(modal?.data?"Terminal updated.":"Terminal added.","success");
    setModal(null);
  },[modal,loadTerminals,toast]);

  const handleUploadTerminalPdf=useCallback(async(terminal,file)=>{
    const {url,error}=await uploadTerminalPdf(terminal.id,file);
    if(error) return toast("PDF upload failed: "+error,"warn");
    await updateTerminal(terminal.id,{...terminal,pdf_url:url});
    await loadTerminals();
    toast("PDF template uploaded.","success");
  },[loadTerminals,toast]);

  if (!authChecked) return (
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"#9ca3af",fontFamily:"'DM Mono',monospace",fontSize:13}}>Loading…</span>
    </div>
  );

  const activeCC=FC[tab]||FC.rt;

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Barlow Condensed',sans-serif",color:"#111827"}}>

      {/* ── AUTH MODAL ─────────────────────────────────────── */}
      {!currentUser && <AuthModal onLogin={handleLogin}/>}

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="app-header" style={{background:"#fff",borderBottom:"1px solid #e5e7eb",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
        <div className="header-inner">
          <div className="header-top">
            <div className="header-brand">
              <div style={{background:"#111827",borderRadius:10,padding:"8px 11px",display:"flex",flexShrink:0}}><Ico n="truck" s={20}/></div>
              <div>
                <div className="brand-title" style={{color:"#111827"}}>PND LOGISTICS MANAGEMENT</div>
                <div className="brand-sub" style={{color:"#9ca3af"}}>ROAD TESTS · UNIFORMS · FLEET · INJURY · ACCIDENTS · HIRING · INSURANCE</div>
              </div>
            </div>
            <div className="header-actions">
              {pendingOut>0&&<div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:7,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}><Ico n="bell" s={13}/><span style={{fontSize:12,color:"#c2410c",fontFamily:"'DM Mono',monospace"}}>{pendingOut} awaiting outcome</span></div>}
              <button onClick={handleSync} disabled={syncing} style={{...Btn("ghost"),padding:"6px 10px",display:"flex",alignItems:"center",gap:5,fontSize:12,opacity:syncing?.5:1,transition:"opacity .2s"}}><span style={{display:"inline-flex",animation:syncing?"spin 1s linear infinite":"none"}}><Ico n="refresh" s={13}/></span>{syncing?"Syncing…":"Sync"}</button>
              {lastSync&&<span className="sync-label" style={{fontSize:10,color:"#9ca3af",fontFamily:"'DM Mono',monospace"}}>{lastSync.toLocaleTimeString()}</span>}
              {currentUser&&(
                <div style={{display:"flex",alignItems:"center",gap:8,borderLeft:"1px solid #e5e7eb",paddingLeft:10,marginLeft:2}}>
                  <span style={{fontSize:11,color:"#6b7280",fontFamily:"'DM Mono',monospace",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</span>
                  <button onClick={handleLogout} style={{background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#374151",padding:"5px 12px",borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:.5}}>Logout</button>
                </div>
              )}
            </div>
          </div>
          <div className="tabs-row">
            {TABS.map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)} style={{borderBottomColor:tab===t.key?t.badgeColor:"transparent",color:tab===t.key?t.badgeColor:"#6b7280",fontWeight:tab===t.key?700:500}}>
                <Ico n={t.icon} s={15}/>{t.label}
                {t.count>0&&<span style={{background:t.badgeColor,color:"#fff",borderRadius:99,padding:"1px 8px",fontSize:10,fontWeight:700}}>{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <div className="stats-bar" style={{background:"#fff",borderBottom:"1px solid #e5e7eb"}}>
        <div className="stats-inner">
          {STATS.map(s=>(
            <div key={s.l} className="stat-item">
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:.8}}>{s.l}</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:s.c,lineHeight:1}}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div className="main-wrap">
        <div className="filter-bar">
          {tab!=="settings"&&<select style={{...INP,width:"auto",minWidth:200}} value={fTerm} onChange={e=>setFTerm(e.target.value)}>
            <option value="All">All Terminals</option>
            {terminals.filter(t=>(t.status||"Active")==="Active").map(t=><option key={t.id} value={`${t.name} - ${t.code}`}>{t.name} - {t.code}</option>)}
          </select>}
          {tab==="rt"&&<select style={{...INP,width:"auto"}} value={fStatus} onChange={e=>setFStatus(e.target.value)}>{["All","Scheduled","Passed","Failed"].map(s=><option key={s} value={s}>{s}</option>)}</select>}
          {tab==="rt"&&<div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="date" style={{...INP,width:"auto"}} value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} title="From date"/>
            <span style={{fontSize:12,color:"#9ca3af"}}>to</span>
            <input type="date" style={{...INP,width:"auto"}} value={fDateTo} onChange={e=>setFDateTo(e.target.value)} title="To date"/>
            {(fDateFrom||fDateTo)&&<button onClick={()=>{setFDateFrom("");setFDateTo("");}} style={{...Btn("ghost"),padding:"4px 8px",fontSize:11,color:"#6b7280"}}>Clear</button>}
          </div>}
          {tab!=="settings"||settingsTab!=="email"
            ?<button onClick={()=>{const d=tab==="settings"?(settingsTab==="users"?users:settingsTab==="terminals"?terminals:null):{rt:rts,uni:unis,fleet:trucks,inj:injs,acc:accs,hir:hirs,ins:insrs,dot:dots}[tab];const key=tab==="settings"?(settingsTab==="users"?"users":settingsTab==="terminals"?"terminals":null):tab;if(d&&key)downloadCSV(key,d);}} style={{...Btn("ghost"),display:"flex",alignItems:"center",gap:6,marginLeft:"auto",padding:"6px 14px",fontSize:12}}>
                <Ico n="dl" s={14}/><span className="sync-label">Download CSV</span>
              </button>
            :<div style={{marginLeft:"auto"}}/>}
          {tab!=="settings"&&addType[tab]&&<button className="add-btn" onClick={()=>setModal({type:addType[tab]})} style={{...Btn(tab==="inj"||tab==="acc"?"danger":"primary",tab==="inj"?"#dc2626":tab==="acc"?FC.acc.h:activeCC.h),display:"flex",alignItems:"center",gap:6}}>
            <Ico n="plus" s={14}/>{addLabel[tab]}
          </button>}
          {tab==="settings"&&settingsTab==="terminals"&&<button onClick={()=>setModal({type:"newTerminal"})} style={{...Btn("primary","#6b7280"),display:"flex",alignItems:"center",gap:6}}><Ico n="plus" s={14}/>Add Terminal</button>}
          {tab==="settings"&&settingsTab==="users"&&<button onClick={()=>setModal({type:"newUser"})} style={{...Btn("primary","#6b7280"),display:"flex",alignItems:"center",gap:6}}><Ico n="plus" s={14}/>Add User</button>}
        </div>

        {!loading&&tab==="rt"&&<div style={{fontSize:14,color:"#6b7280",padding:"4px 2px"}}>Showing <span style={{fontWeight:700,color:activeCC.h}}>{fRts.length}</span> road test{fRts.length!==1?"s":""}</div>}

        {loading ? (
          <div style={{textAlign:"center",padding:80,color:"#9ca3af",fontFamily:"'DM Mono',monospace"}}>Loading shared data…</div>
        ) : tab==="rt" ? (
          fRts.length===0
            ?<Empty msg="No road tests yet. Click Schedule Road Test to begin."/>
            :<Grid>{fRts.map(t=><RTCard key={t.id} test={t} onEdit={t=>setModal({type:"editRT",data:t})} onOutcome={t=>setModal({type:"outcome",data:t})} onDelete={delRT} onSms={t=>setModal({type:"sms",data:t})} users={users} terminals={terminals} onError={msg=>toast(msg,"warn")}/>)}</Grid>
        ) : tab==="uni" ? (
          fUnis.length===0
            ?<Empty msg="No uniform requests yet."/>
            :<Grid>{fUnis.map(u=><UniCard key={u.id} req={u} onEdit={r=>setModal({type:"editUni",data:r})} onDelete={delUni} onFulfill={fulfillUni}/>)}</Grid>
        ) : tab==="fleet" ? (<>
          {truckAlerts>0&&<div style={{background:EXP.warning.bg,border:"1px solid "+EXP.warning.bd,borderRadius:9,padding:"11px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}><Ico n="warn" s={16}/><span style={{fontSize:14,color:EXP.warning.tx,fontWeight:700}}>{truckAlerts} truck{truckAlerts>1?"s":""} require attention — registration or inspection expiring soon / expired</span></div>}
          {fTrucks.length===0
            ?<Empty msg="No trucks yet. Click Add Truck to begin."/>
            :<Grid>{fTrucks.map(t=><TruckCard key={t.id} truck={t} onEdit={t=>setModal({type:"editTruck",data:t})} onDelete={delTruck}/>)}</Grid>}
        </>) : tab==="inj" ? (
          fInjs.length===0
            ?<Empty msg="No injury reports filed yet. Click File Injury Report to begin."/>
            :<Grid>{fInjs.map(r=><InjuryCard key={r.id} report={r} onView={r=>setModal({type:"viewInj",data:r})} onEdit={r=>setModal({type:"editInj",data:r})} onDelete={delInj}/>)}</Grid>
        ) : tab==="acc" ? (
          fAccs.length===0
            ?<Empty msg="No accident reports filed yet. Click File Accident Report to begin."/>
            :<Grid>{fAccs.map(r=><AccidentCard key={r.id} report={r} onView={r=>setModal({type:"viewAcc",data:r})} onEdit={r=>setModal({type:"editAcc",data:r})} onDelete={delAcc}/>)}</Grid>
        ) : tab==="hir" ? (
          fHirs.length===0
            ?<Empty msg="No hiring requests yet. Click New Hiring Request to begin."/>
            :<Grid>{fHirs.map(r=><HiringCard key={r.id} req={r} onEdit={r=>setModal({type:"editHir",data:r})} onDelete={delHir}/>)}</Grid>
        ) : tab==="ins" ? (
          fInsrs.length===0
            ?<Empty msg="No insurance requests yet. Click New Insurance Request to begin."/>
            :<Grid>{fInsrs.map(r=><InsuranceCard key={r.id} req={r} onEdit={r=>setModal({type:"editIns",data:r})} onDelete={delInsr} onEmail={r=>setModal({type:"insEmail",data:r})}/>)}</Grid>
        ) : tab==="dot" ? (
          fDots.length===0
            ?<Empty msg="No DOT cards yet. Click + DOT Card to add one."/>
            :<Grid>{fDots.map(r=><DOTCard key={r.id} card={r} onEdit={r=>setModal({type:"editDot",data:r})} onDelete={delDot} onUpload={handleUploadDotCardFile}/>)}</Grid>
        ) : tab==="settings"&&currentUser?.role==="admin" ? (
          <div>
            <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:10,padding:4,marginBottom:24,width:"fit-content"}}>
              {[{key:"terminals",label:"Terminals"},{key:"users",label:"Users"},{key:"email",label:"Email Notifications"}].map(st=>(
                <button key={st.key} onClick={()=>setSettingsTab(st.key)} style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",background:settingsTab===st.key?"#fff":"transparent",color:settingsTab===st.key?"#111827":"#6b7280",boxShadow:settingsTab===st.key?"0 1px 4px rgba(0,0,0,.1)":undefined,transition:"all .15s"}}>
                  {st.label}
                </button>
              ))}
            </div>
            {settingsTab==="terminals" ? (<>
              <div style={{marginBottom:16}}>
                <select style={{...INP,width:"auto"}} value={fTerminalStatus} onChange={e=>setFTerminalStatus(e.target.value)}>{["Active","Inactive","All"].map(s=><option key={s} value={s}>{s}</option>)}</select>
              </div>
              {fTerminals.length===0
                ?<Empty msg={terminals.length===0?"No terminals yet. Click Add Terminal to create one.":"No terminals match the selected filter."}/>
                :<Grid>{fTerminals.map(t=><TerminalCard key={t.id} terminal={t} onEdit={t=>setModal({type:"editTerminal",data:t})} onUploadPdf={handleUploadTerminalPdf}/>)}</Grid>
              }
            </>) : settingsTab==="users" ? (
              users.length===0
                ?<Empty msg="No users yet. Click Add User to create one."/>
                :<Grid>{users.map(u=><UserCard key={u.id} user={u} onEdit={u=>setModal({type:"editUser",data:u})} isSelf={u.id===currentUser?.id}/>)}</Grid>
            ) : settingsTab==="email" ? (
              <div style={{maxWidth:640}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <span style={{fontWeight:800,fontSize:22,color:"#111827"}}>Email Notifications</span>
                  <button style={Btn("primary")} onClick={handleSaveSettings}>Save Settings</button>
                </div>
                <EmailSettingsForm
                  moduleKey="roadTestOutcome"
                  label="Road Test Outcome"
                  placeholders={["candidateName","fedexId","phone","terminal","date","time","status","feedback","firstDay","completedAt"]}
                  config={emailSettings.roadTestOutcome}
                  onChange={handleSettingsChange}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── MODALS ─────────────────────────────────────────── */}
      {modal?.type==="newRT"     && <Modal title="Schedule Road Test"        onClose={()=>setModal(null)} wide><RTForm      onSave={saveRT}      onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editRT"    && <Modal title="Edit Road Test"            onClose={()=>setModal(null)} wide><RTForm      onSave={saveRT}      onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="outcome"   && <Modal title="Enter Road Test Outcome"   onClose={()=>setModal(null)}     ><OutcomeForm onSave={saveOutcome} onClose={()=>setModal(null)} test={modal.data}/></Modal>}
      {modal?.type==="sms"       && <SmsModal test={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newUni"    && <Modal title="New Uniform Order"         onClose={()=>setModal(null)} wide><UniForm    onSave={saveUni}     onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editUni"   && <Modal title="Edit Uniform Request"      onClose={()=>setModal(null)} wide><UniForm    onSave={saveUni}     onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="newTruck"  && <Modal title="Add Truck to Fleet"        onClose={()=>setModal(null)} wide><TruckForm  onSave={saveTruck}   onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editTruck" && <Modal title="Edit Truck"                onClose={()=>setModal(null)} wide><TruckForm  onSave={saveTruck}   onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="newInj"    && <Modal title="File Work Injury Report"   onClose={()=>setModal(null)} wide><InjuryForm onSave={saveInj}     onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editInj"   && <Modal title="Edit Injury Report"        onClose={()=>setModal(null)} wide><InjuryForm onSave={saveInj}     onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="viewInj"   && <InjuryDetail report={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newAcc"    && <Modal title="File Accident Report"     onClose={()=>setModal(null)} wide><AccidentForm  onSave={saveAcc}  onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editAcc"   && <Modal title="Edit Accident Report"     onClose={()=>setModal(null)} wide><AccidentForm  onSave={saveAcc}  onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="viewAcc"   && <AccidentDetail report={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newHir"    && <Modal title="New Hiring Request"        onClose={()=>setModal(null)} wide><HiringForm    onSave={saveHir}  onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editHir"   && <Modal title="Edit Hiring Request"       onClose={()=>setModal(null)} wide><HiringForm    onSave={saveHir}  onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="hirNotify" && <HRNotifyModal req={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newIns"    && <Modal title="New Insurance Request"     onClose={()=>setModal(null)} wide><InsuranceForm onSave={saveInsr} onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editIns"   && <Modal title="Edit Insurance Request"    onClose={()=>setModal(null)} wide><InsuranceForm onSave={saveInsr} onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="insEmail"  && <InsuranceEmailModal req={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newDot"    && <Modal title="Add DOT Card"          onClose={()=>setModal(null)} wide><DOTCardForm onSave={saveDot}  onClose={()=>setModal(null)} terminals={terminals}/></Modal>}
      {modal?.type==="editDot"   && <Modal title="Edit DOT Card"         onClose={()=>setModal(null)} wide><DOTCardForm onSave={saveDot}  onClose={()=>setModal(null)} existing={modal.data} terminals={terminals}/></Modal>}
      {modal?.type==="newUser"       && <Modal title="Create User"      onClose={()=>setModal(null)} wide><UserForm     onSave={handleSaveUser}     onClose={()=>setModal(null)} allUsers={users} terminals={terminals}/></Modal>}
      {modal?.type==="editUser"      && <Modal title="Edit User"        onClose={()=>setModal(null)} wide><UserForm     onSave={handleSaveUser}     onClose={()=>setModal(null)} existing={modal.data} allUsers={users} terminals={terminals}/></Modal>}
      {modal?.type==="newTerminal"   && <Modal title="Add Terminal"     onClose={()=>setModal(null)} wide><TerminalForm onSave={handleSaveTerminal} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editTerminal"  && <Modal title="Edit Terminal"    onClose={()=>setModal(null)} wide><TerminalForm onSave={handleSaveTerminal} onClose={()=>setModal(null)} existing={modal.data}/></Modal>}

      <Toast toasts={toasts}/>
    </div>
  );
}
