import { useState, useEffect, useCallback } from "react";
import { dbLoad, dbSave } from "./src/lib/db.js";
import { login, logout, getSession, fetchUsers, createUser, updateUser } from "./src/lib/auth.js";
import { sendRoadTestOutcomeEmail } from "./src/lib/email.js";

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
const SK = { rt:"pnd_rt_v5", uni:"pnd_uni_v5", tr:"pnd_tr_v5", inj:"pnd_inj_v5" };
const SC = { Scheduled:{bg:"#0d2240",text:"#4db8ff",border:"#1a4a80"}, Passed:{bg:"#0a2a18",text:"#00ee77",border:"#1a6a3a"}, Failed:{bg:"#2a0d0d",text:"#ff5555",border:"#7a2020"}, Pending:{bg:"#1e1800",text:"#ffcc44",border:"#5a4800"}, Completed:{bg:"#1a0d2a",text:"#bb88ff",border:"#4a2a7a"} };
const EC = { expired:{bg:"#2a0d0d",text:"#ff6666",border:"#7a2020"}, warning:{bg:"#2a1a00",text:"#ffaa00",border:"#7a4400"}, ok:{bg:"#0a1a0a",text:"#00cc66",border:"#1a5a2a"}, none:{bg:"#141428",text:"#6868a0",border:"#252548"} };

// ─── Shared style helpers ──────────────────────────────────────────────────────
const IS = { width:"100%", background:"#111124", border:"1px solid #2e2e4a", borderRadius:6, padding:"9px 12px", color:"#eeeeff", fontSize:14, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" };
const B  = (v="primary") => ({ padding:"9px 18px", borderRadius:6, border:"none", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:14, letterSpacing:.5, background:v==="primary"?"#ff6200":v==="success"?"#00a050":v==="danger"?"#cc2000":"#1c1c32", color:v==="ghost"?"#9090b8":"#fff" });

// ─── Utility ──────────────────────────────────────────────────────────────────
function daysUntil(d){ if(!d) return null; return Math.ceil((new Date(d+"T12:00:00")-new Date())/86400000); }
function expStatus(d){ const n=daysUntil(d); if(n===null)return"none"; if(n<0)return"expired"; if(n<=30)return"warning"; return"ok"; }
function expLabel(d) { const n=daysUntil(d); if(n===null)return"-"; if(n<0)return`Expired ${Math.abs(n)}d ago`; if(n===0)return"Expires TODAY"; return`${n}d remaining`; }

function buildSms(f) {
  const t=TERMINAL_DATA[f.terminal]||{};
  const d=f.date?new Date(f.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}):"[date]";
  return `Hello ${f.candidateName||"[Candidate]"},\n\nYour road test has been scheduled:\n\n📍 ${f.terminal}\n   ${t.address||""}\n\n📅 ${d}\n⏰ ${f.time||""}\n\nManager: ${t.manager||""}\n📞 ${t.phone||""}\n\nPlease arrive 10 min early with a valid driver's license.\n\nGood luck!\n- PND Logistics HR Team`;
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
  if(n==="eye")     return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
  return null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({toasts}) {
  return (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:"calc(100vw - 40px)"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:t.type==="success"?"#0a2a18":t.type==="warn"?"#2a1e00":"#14142e",border:`1px solid ${t.type==="success"?"#00aa55":t.type==="warn"?"#aa8800":"#3a3a7a"}`,color:t.type==="success"?"#00ee77":t.type==="warn"?"#ffcc44":"#aaaaff",padding:"10px 16px",borderRadius:10,fontSize:13,fontFamily:"'DM Mono',monospace",maxWidth:340,animation:"slideIn .2s ease",boxShadow:"0 4px 20px rgba(0,0,0,0.6)"}}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,wide}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box ${wide?"wide":"narrow"}`} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{margin:0,fontSize:19,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,fontWeight:700}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#7070a0",cursor:"pointer",padding:4,display:"flex"}}><Ico n="x" s={17}/></button>
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
      <label style={{display:"block",fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,marginBottom:5,textTransform:"uppercase",fontWeight:500}}>{label}</label>
      {children}
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────
const CSV_COLS = {
  rt:    ["id","candidateName","phone","fedexId","terminal","date","time","duration","status","manager","notes","feedback","firstDay","completedAt","createdAt"],
  uni:   ["id","terminal","requestedBy","status","notes","items","createdAt","fulfilledAt"],
  fleet: ["id","terminal","truckNumber","licensePlate","regState","regExpiry","inspExpiry","vin","notes","createdAt","updatedAt"],
  inj:   ["id","terminal","employeeName","injuryDate","injuryTime","injuryAddress","description","bodyPart","medicalAttention","medicalProvider","missedWork","missedDays","witnesses","reportedBy","createdAt"],
  users: ["id","name","username","role","terminal","phone","email","status","createdAt"],
};

function toCSV(rows, cols) {
  const esc = v => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v)
      ? v.map(i => `${i.qty}x ${i.type} (${i.size})`).join("; ")
      : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body   = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function downloadCSV(tab, data) {
  const cols = CSV_COLS[tab];
  if (!cols) return;
  const csv  = toCSV(data, cols);
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
  const c=SC[status]||{bg:"#1a1a2a",text:"#8888aa",border:"#333355"};
  return <span style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`,padding:"3px 11px",borderRadius:99,fontSize:11,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",fontWeight:500}}>{status}</span>;
}

// ─── Terminal Info ────────────────────────────────────────────────────────────
function TInfo({tk}) {
  const t=TERMINAL_DATA[tk]; if(!t) return null;
  return (
    <div style={{background:"#0a1828",border:"1px solid #1e4060",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:7,marginBottom:6}}>
        <span style={{color:"#5599ff",flexShrink:0,marginTop:1}}><Ico n="pin" s={12}/></span>
        <span style={{fontSize:12,color:"#7ab8dd",fontFamily:"'DM Mono',monospace",lineHeight:1.6}}>{t.address}</span>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:"#5599ff"}}><Ico n="user" s={11}/></span><span style={{fontSize:12,color:"#7ab8dd",fontFamily:"'DM Mono',monospace"}}>{t.manager}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:"#5599ff"}}><Ico n="phone" s={11}/></span><span style={{fontSize:12,color:"#7ab8dd",fontFamily:"'DM Mono',monospace"}}>{t.phone}</span></div>
      </div>
    </div>
  );
}

// ─── SMS Modal ────────────────────────────────────────────────────────────────
function SmsModal({test,onClose}) {
  const [copied,setCopied]=useState(false);
  const [sent,setSent]=useState(false);
  const msg=buildSms(test);
  const digits=(test.phone||"").replace(/\D/g,"");
  const openSms=()=>{window.location.href=`sms:${digits}?body=${encodeURIComponent(msg)}`;setSent(true);};
  const openWa=()=>{window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`,"_blank");setSent(true);};
  const copy=()=>{
    navigator.clipboard.writeText(msg).catch(()=>{const el=document.createElement("textarea");el.value=msg;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);});
    setCopied(true);setTimeout(()=>setCopied(false),3000);
  };
  return (
    <Modal title="Send Candidate Notification" onClose={onClose} wide>
      <div style={{background:"#070f07",border:"1px solid #1e5a1e",borderRadius:10,padding:18}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,background:"#0a1a0a",border:"1px solid #1e4a1e",borderRadius:8,padding:"10px 14px"}}>
          <div style={{background:"#00aa55",borderRadius:"50%",width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico n="user" s={18}/></div>
          <div>
            <div style={{fontSize:17,color:"#eeeeff",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}}>{test.candidateName}</div>
            <div style={{fontSize:13,color:"#00cc66",fontFamily:"'DM Mono',monospace"}}>{test.phone}</div>
          </div>
          {sent&&<div style={{marginLeft:"auto",background:"#0a2a18",border:"1px solid #00aa55",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#00ee77",fontFamily:"'DM Mono',monospace"}}>✅ Sent!</div>}
        </div>
        <div className="sms-btn-grid">
          <button onClick={openSms} style={{background:"linear-gradient(135deg,#00aa55,#007733)",border:"none",borderRadius:10,padding:"16px 12px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <Ico n="sms" s={26}/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:"#fff"}}>TEXT MESSAGE</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,.65)"}}>Opens Messages app</span>
          </button>
          <button onClick={openWa} style={{background:"linear-gradient(135deg,#1a5c2a,#0d3318)",border:"1px solid #1a6a2a",borderRadius:10,padding:"16px 12px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <span style={{fontSize:26}}>💬</span><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:"#44ee88"}}>WHATSAPP</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(68,238,136,.55)"}}>Opens WhatsApp</span>
          </button>
        </div>
        <pre style={{margin:0,fontFamily:"'DM Mono',monospace",fontSize:12,color:"#77bb88",lineHeight:1.75,whiteSpace:"pre-wrap",wordBreak:"break-word",background:"#030a03",border:"1px solid #152a15",borderRadius:8,padding:14,maxHeight:200,overflowY:"auto"}}>{msg}</pre>
        <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={copy} style={{background:copied?"#0a2a18":"#1c1c32",border:`1px solid ${copied?"#00aa55":"#2e2e4a"}`,color:copied?"#00ee77":"#9090b8",padding:"8px 14px",borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:5}}>
            <Ico n="copy" s={13}/>{copied?"✅ Copied!":"Copy Text"}
          </button>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#7070a0",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:13}}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Road Test Form ───────────────────────────────────────────────────────────
function RTForm({onSave,onClose,existing}) {
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const [form,setForm]=useState(existing||{candidateName:"",phone:"",fedexId:"",terminal:TERMINALS[0],date:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,time:`${pad(now.getHours())}:${pad(now.getMinutes())}`,duration:"60",notes:""});
  const [prev,setPrev]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=withSms=>{
    if(!form.candidateName||!form.phone||!form.fedexId) return alert("Please fill in Name, Phone, and FedEx ID.");
    onSave({...form,id:existing?.id||Date.now().toString(),status:existing?.status||"Scheduled",createdAt:existing?.createdAt||new Date().toISOString(),_sms:withSms});
  };
  return <>
    <div className="form-grid-2">
      <Field label="Candidate Full Name *"><input style={IS} value={form.candidateName} onChange={e=>set("candidateName",e.target.value)} placeholder="Jane Smith"/></Field>
      <Field label="Candidate Phone *"><input style={IS} value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
      <Field label="FedEx ID *"><input style={IS} value={form.fedexId} onChange={e=>set("fedexId",e.target.value)} placeholder="FX-000000"/></Field>
      <Field label="Terminal Location"><select style={IS} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <div className="form-grid-3">
      <Field label="Test Date"><input style={IS} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
      <Field label="Start Time"><input style={IS} type="time" value={form.time} onChange={e=>set("time",e.target.value)}/></Field>
      <Field label="Duration (min)"><input style={IS} type="number" min="15" max="240" value={form.duration} onChange={e=>set("duration",e.target.value)}/></Field>
    </div>
    <Field label="Notes" span><textarea style={{...IS,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Additional notes..."/></Field>
    {prev&&<div style={{background:"#030a03",border:"1px solid #1a5a1a",borderRadius:8,padding:14,marginBottom:14}}><div style={{fontSize:10,color:"#3a9a3a",fontFamily:"'DM Mono',monospace",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>SMS Preview</div><pre style={{margin:0,fontFamily:"'DM Mono',monospace",fontSize:11,color:"#77bb88",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{buildSms(form)}</pre></div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      {!existing&&<button style={{background:"none",border:"1px solid #1e5a1e",color:"#44dd77",padding:"8px 14px",borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:5}} onClick={()=>setPrev(p=>!p)}><Ico n="sms" s={13}/>{prev?"Hide":"Preview SMS"}</button>}
      <button style={B("primary")} onClick={()=>doSave(!existing)}>{existing?"Update Test":"Schedule & Send SMS"}</button>
    </div>
  </>;
}

// ─── Outcome Form ─────────────────────────────────────────────────────────────
function OutcomeForm({test,onSave,onClose}) {
  const [passed,setPassed]=useState(null);
  const [firstDay,setFirstDay]=useState("");
  const [feedback,setFeedback]=useState(test.feedback||"");
  const save=()=>{if(passed===null)return alert("Select Pass or Fail.");onSave({...test,status:passed?"Passed":"Failed",firstDay:passed?firstDay:null,feedback,completedAt:new Date().toISOString()});};
  return <>
    <div style={{background:"#131326",border:"1px solid #2a2a48",borderRadius:8,padding:14,marginBottom:14}}>
      <div style={{fontSize:10,color:"#7070a0",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:1}}>Candidate</div>
      <div style={{fontSize:20,color:"#eeeeff",fontWeight:700,marginTop:4,fontFamily:"'Barlow Condensed',sans-serif"}}>{test.candidateName}</div>
      <div style={{fontSize:12,color:"#7878a8",marginTop:2,fontFamily:"'DM Mono',monospace"}}>{test.fedexId} · {test.phone}</div>
    </div>
    <TInfo tk={test.terminal}/>
    <Field label="Road Test Result *">
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setPassed(true)}  style={{...B(passed===true?"success":"ghost"),flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico n="check" s={14}/>PASSED</button>
        <button onClick={()=>setPassed(false)} style={{...B(passed===false?"danger":"ghost"),flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico n="x" s={14}/>FAILED</button>
      </div>
    </Field>
    {passed&&<Field label="First Day of Training"><input style={IS} type="date" value={firstDay} onChange={e=>setFirstDay(e.target.value)}/></Field>}
    <Field label="Manager Feedback"><textarea style={{...IS,height:80,resize:"vertical"}} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Observations..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      <button style={B(passed===false?"danger":"primary")} onClick={save}>Submit Outcome</button>
    </div>
  </>;
}

// ─── Road Test Card ───────────────────────────────────────────────────────────
function RTCard({test,onEdit,onOutcome,onDelete,onSms}) {
  const start=new Date(`${test.date}T${test.time}`);
  const end=new Date(start.getTime()+parseInt(test.duration||60)*60000);
  const needsOutcome=new Date()>=end&&test.status==="Scheduled";
  const t=TERMINAL_DATA[test.terminal]||{};
  return (
    <div className="card" style={{background:"#0d0d20",border:`1px solid ${needsOutcome?"#ff6200":"#262642"}`,borderRadius:12,padding:18,boxShadow:needsOutcome?"0 0 0 1px #ff6200,0 0 24px rgba(255,98,0,.12)":"0 2px 12px rgba(0,0,0,0.4)"}}>
      {needsOutcome&&<div style={{background:"#2a1200",border:"1px solid #ff6200",borderRadius:7,padding:"7px 11px",marginBottom:12,display:"flex",alignItems:"center",gap:6,animation:"pulse 2s infinite"}}><Ico n="bell" s={13}/><span style={{fontSize:12,color:"#ffaa55",fontFamily:"'DM Mono',monospace",fontWeight:500}}>Road test ended — awaiting outcome</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif"}}>{test.candidateName}</div>
          <div style={{fontSize:11,color:"#7070a8",fontFamily:"'DM Mono',monospace",marginTop:2}}>FX ID: {test.fedexId}</div>
        </div>
        <Badge status={test.status}/>
      </div>
      <div style={{fontSize:12,color:"#8888aa",fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
        <div>📞 {test.phone}</div>
        <div style={{color:"#5599cc"}}>📍 {test.terminal}</div>
        <div style={{color:"#4a7090",paddingLeft:18}}>{t.address}</div>
        <div style={{color:"#9090aa"}}>📅 {new Date(test.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})} · ⏰ {test.time}</div>
        <div style={{color:"#6080a0"}}>👤 {t.manager} · {t.phone}</div>
        {test.createdBy&&<div style={{color:"#4a4a70",marginTop:2}}>🗂 Scheduled by {test.createdBy.name}</div>}
      </div>
      {test.status==="Passed"&&<div style={{background:"#071a0f",border:"1px solid #1a5a2a",borderRadius:7,padding:"7px 11px",marginBottom:12,fontSize:12,color:"#00dd66",fontFamily:"'DM Mono',monospace"}}>✅ PASSED{test.firstDay?` · Training: ${new Date(test.firstDay+"T12:00:00").toLocaleDateString()}`:""}</div>}
      {test.status==="Failed"&&<div style={{background:"#1a0707",border:"1px solid #6a1a1a",borderRadius:7,padding:"7px 11px",marginBottom:12,fontSize:12,color:"#ff6666",fontFamily:"'DM Mono',monospace"}}>❌ FAILED{test.feedback?` · ${test.feedback.slice(0,70)}`:""}</div>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {(test.status==="Scheduled"||test.status==="In Progress")&&<>
          <button onClick={()=>onEdit(test)} style={{...B("ghost"),padding:"5px 12px",fontSize:12}}>Edit</button>
          <button onClick={()=>onSms(test)} style={{background:"none",border:"1px solid #1e5a1e",color:"#44dd77",cursor:"pointer",padding:"5px 10px",borderRadius:5,fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Ico n="sms" s={12}/>SMS</button>
          {needsOutcome&&<button onClick={()=>onOutcome(test)} style={{...B("primary"),padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:5}}><Ico n="clip" s={12}/>Enter Outcome</button>}
        </>}
        <button onClick={()=>onDelete(test.id)} style={{...B("ghost"),padding:"5px 8px",marginLeft:"auto",color:"#ff5555"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Uniform Form ─────────────────────────────────────────────────────────────
function UniForm({onSave,onClose,existing}) {
  const [form,setForm]=useState(existing||{terminal:TERMINALS[0],requestedBy:"",items:[{type:UNIFORM_TYPES[0],size:defSize(UNIFORM_TYPES[0]),qty:1}],notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addItem=()=>set("items",[...form.items,{type:UNIFORM_TYPES[0],size:defSize(UNIFORM_TYPES[0]),qty:1}]);
  const remItem=i=>set("items",form.items.filter((_,idx)=>idx!==i));
  const updItem=(i,k,v)=>set("items",form.items.map((item,idx)=>{if(idx!==i)return item;const n={...item,[k]:v};if(k==="type")n.size=defSize(v);return n;}));
  const doSave=()=>{if(!form.requestedBy)return alert("Please enter the requester's name.");onSave({...form,id:existing?.id||Date.now().toString(),status:existing?.status||"Pending",createdAt:existing?.createdAt||new Date().toISOString()});};
  return <>
    <div className="form-grid-2">
      <Field label="Terminal Location"><select style={IS} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
      <Field label="Requested By *"><input style={IS} value={form.requestedBy} onChange={e=>set("requestedBy",e.target.value)} placeholder="Manager name"/></Field>
    </div>
    <TInfo tk={form.terminal}/>
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <label style={{fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,textTransform:"uppercase",fontWeight:500}}>Uniform Items</label>
        <button onClick={addItem} style={{background:"none",border:"1px solid #2e2e4a",color:"#9090b8",cursor:"pointer",padding:"4px 10px",borderRadius:5,fontSize:12,display:"flex",alignItems:"center",gap:4,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}><Ico n="plus" s={12}/>Add Item</button>
      </div>
      <div style={{background:"#0f0f22",borderRadius:8,padding:"10px 12px",border:"1px solid #1e1e38"}}>
        <div className="uni-items-header">
          {["Item Type","Size","Qty",""].map((h,i)=><span key={i} style={{fontSize:10,color:"#6060a0",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{h}</span>)}
        </div>
        {form.items.map((item,i)=>(
          <div key={i} className="uni-items-row">
            <select style={{...IS,padding:"7px 10px",fontSize:13}} value={item.type} onChange={e=>updItem(i,"type",e.target.value)}>{UNIFORM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <select style={{...IS,padding:"7px 10px",fontSize:13}} value={item.size} onChange={e=>updItem(i,"size",e.target.value)}>{getSizes(item.type).map(s=><option key={s} value={s}>{BOTTOM_TYPES.includes(item.type)?`W${s}`:s}</option>)}</select>
            <input style={{...IS,padding:"7px 8px",fontSize:13}} type="number" min="1" max="200" value={item.qty} onChange={e=>updItem(i,"qty",parseInt(e.target.value)||1)}/>
            {form.items.length>1?<button onClick={()=>remItem(i)} style={{background:"none",border:"none",color:"#ff5555",cursor:"pointer",padding:4,display:"flex"}}><Ico n="x" s={13}/></button>:<span/>}
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#5a5a88",fontFamily:"'DM Mono',monospace",marginTop:6}}>Pants & Shorts: waist sizes W24–W48. All others: XS–4XL.</div>
    </div>
    <Field label="Notes / Employee Names"><textarea style={{...IS,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Employee names, special requirements..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      <button style={B("primary")} onClick={doSave}>{existing?"Update Request":"Submit Order"}</button>
    </div>
  </>;
}

// ─── Uniform Card ─────────────────────────────────────────────────────────────
function UniCard({req,onEdit,onDelete,onFulfill}) {
  const total=req.items.reduce((s,i)=>s+i.qty,0);
  const t=TERMINAL_DATA[req.terminal]||{};
  return (
    <div className="card" style={{background:"#0d0d20",border:"1px solid #262642",borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif"}}>{req.terminal}</div>
          <div style={{fontSize:11,color:"#7070a8",fontFamily:"'DM Mono',monospace",marginTop:2}}>By: {req.requestedBy}</div>
        </div>
        <Badge status={req.status}/>
      </div>
      {t.address&&<div style={{fontSize:11,color:"#4a6a80",fontFamily:"'DM Mono',monospace",marginBottom:10}}>📍 {t.address}</div>}
      <div style={{background:"#0a0a1e",borderRadius:7,padding:"8px 10px",marginBottom:10,border:"1px solid #1e1e38"}}>
        {req.items.map((item,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaaacc",fontFamily:"'DM Mono',monospace",padding:"4px 0",borderBottom:i<req.items.length-1?"1px solid #1e1e38":"none"}}>
            <span>{item.type}</span>
            <span style={{color:"#7878a8"}}>{BOTTOM_TYPES.includes(item.type)?`W${item.size}`:item.size} × {item.qty}</span>
          </div>
        ))}
        <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid #252548",display:"flex",justifyContent:"space-between",fontSize:11,color:"#6060a0",fontFamily:"'DM Mono',monospace"}}>
          <span>TOTAL PIECES</span><span style={{color:"#9090b8",fontWeight:600}}>{total}</span>
        </div>
      </div>
      {req.notes&&<div style={{fontSize:11,color:"#607080",fontFamily:"'DM Mono',monospace",marginBottom:8,fontStyle:"italic"}}>{req.notes}</div>}
      <div style={{fontSize:11,color:"#505080",fontFamily:"'DM Mono',monospace",marginBottom:12}}>Submitted {new Date(req.createdAt).toLocaleDateString()}</div>
      <div style={{display:"flex",gap:6}}>
        {req.status==="Pending"&&<>
          <button onClick={()=>onEdit(req)} style={{...B("ghost"),padding:"5px 12px",fontSize:12}}>Edit</button>
          <button onClick={()=>onFulfill(req.id)} style={{...B("success"),padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:5}}><Ico n="check" s={12}/>Mark Fulfilled</button>
        </>}
        <button onClick={()=>onDelete(req.id)} style={{...B("ghost"),padding:"5px 8px",marginLeft:"auto",color:"#ff5555"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Expiry Pill ──────────────────────────────────────────────────────────────
function ExpPill({label,dateStr}) {
  const s=expStatus(dateStr); const c=EC[s];
  return (
    <div style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,padding:"9px 12px",flex:1}}>
      <div style={{fontSize:10,color:c.text,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",opacity:.75,marginBottom:3,letterSpacing:.8}}>{label}</div>
      <div style={{fontSize:12,color:"#eeeeff",fontFamily:"'DM Mono',monospace",marginBottom:3}}>{dateStr?new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"Not set"}</div>
      <div style={{fontSize:11,color:c.text,fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:4}}>{(s==="expired"||s==="warning")&&<Ico n="warn" s={11}/>}{expLabel(dateStr)}</div>
    </div>
  );
}

// ─── Truck Form ───────────────────────────────────────────────────────────────
function TruckForm({onSave,onClose,existing}) {
  const [form,setForm]=useState(existing||{terminal:TERMINALS[0],truckNumber:"",licensePlate:"",regState:"",regExpiry:"",inspExpiry:"",vin:"",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=()=>{if(!form.truckNumber||!form.licensePlate)return alert("Please fill in Truck # and License Plate.");onSave({...form,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});};
  return <>
    <div className="form-grid-2">
      <Field label="Terminal Location"><select style={IS} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
      <Field label="Truck / Unit # *"><input style={IS} value={form.truckNumber} onChange={e=>set("truckNumber",e.target.value)} placeholder="e.g. T-101"/></Field>
      <Field label="License Plate *"><input style={IS} value={form.licensePlate} onChange={e=>set("licensePlate",e.target.value)} placeholder="e.g. ABC-1234"/></Field>
      <Field label="Registration State"><input style={IS} value={form.regState} onChange={e=>set("regState",e.target.value)} placeholder="TX, KY, GA..." maxLength={2}/></Field>
      <Field label="Registration Expiration"><input style={IS} type="date" value={form.regExpiry} onChange={e=>set("regExpiry",e.target.value)}/></Field>
      <Field label="State Inspection Expiration"><input style={IS} type="date" value={form.inspExpiry} onChange={e=>set("inspExpiry",e.target.value)}/></Field>
      <Field label="VIN (optional)"><input style={IS} value={form.vin} onChange={e=>set("vin",e.target.value)} placeholder="Vehicle Identification Number"/></Field>
    </div>
    <Field label="Notes"><textarea style={{...IS,height:58,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any additional info..."/></Field>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      <button style={B("primary")} onClick={doSave}>{existing?"Update Truck":"Add Truck"}</button>
    </div>
  </>;
}

// ─── Truck Card ───────────────────────────────────────────────────────────────
function TruckCard({truck,onEdit,onDelete}) {
  const rs=expStatus(truck.regExpiry),is=expStatus(truck.inspExpiry);
  const hasAlert=rs==="expired"||rs==="warning"||is==="expired"||is==="warning";
  const isExp=rs==="expired"||is==="expired";
  const t=TERMINAL_DATA[truck.terminal]||{};
  return (
    <div className="card" style={{background:"#0d0d20",border:`1px solid ${hasAlert?(isExp?"#7a2020":"#7a4400"):"#262642"}`,borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
      {hasAlert&&<div style={{background:isExp?"#2a0d0d":"#2a1a00",border:`1px solid ${isExp?"#ff5555":"#ffaa00"}`,borderRadius:7,padding:"7px 11px",marginBottom:12,display:"flex",alignItems:"center",gap:6,animation:"pulse 2s infinite"}}><Ico n="warn" s={13}/><span style={{fontSize:12,color:isExp?"#ff8888":"#ffcc44",fontFamily:"'DM Mono',monospace",fontWeight:500}}>{isExp?"EXPIRED — action required":"Expiring within 30 days — renewal needed"}</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:21,fontWeight:800,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>🚚 {truck.truckNumber}</div>
          <div style={{fontSize:12,color:"#5599cc",fontFamily:"'DM Mono',monospace",marginTop:2}}>{truck.terminal}</div>
          <div style={{fontSize:11,color:"#4a6a80",fontFamily:"'DM Mono',monospace"}}>{t.address}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,color:"#eeeeff",fontFamily:"'DM Mono',monospace",fontWeight:700}}>{truck.licensePlate}</div>
          {truck.regState&&<div style={{fontSize:11,color:"#7070a8",fontFamily:"'DM Mono',monospace",marginTop:2}}>State: {truck.regState.toUpperCase()}</div>}
        </div>
      </div>
      {truck.vin&&<div style={{fontSize:11,color:"#6060a0",fontFamily:"'DM Mono',monospace",marginBottom:10}}>VIN: {truck.vin}</div>}
      <div style={{display:"flex",gap:8,marginBottom:12}}><ExpPill label="Registration" dateStr={truck.regExpiry}/><ExpPill label="State Inspection" dateStr={truck.inspExpiry}/></div>
      <div style={{fontSize:11,color:"#6080a0",fontFamily:"'DM Mono',monospace",marginBottom:10}}>👤 {t.manager} · {t.phone}</div>
      {truck.notes&&<div style={{fontSize:11,color:"#607080",fontFamily:"'DM Mono',monospace",marginBottom:10,fontStyle:"italic"}}>{truck.notes}</div>}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>onEdit(truck)} style={{...B("ghost"),padding:"5px 12px",fontSize:12}}>Edit</button>
        <button onClick={()=>onDelete(truck.id)} style={{...B("ghost"),padding:"5px 8px",marginLeft:"auto",color:"#ff5555"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Injury Form ──────────────────────────────────────────────────────────────
function InjuryForm({onSave,onClose,existing}) {
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const [form,setForm]=useState(existing||{terminal:TERMINALS[0],employeeName:"",injuryDate:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,injuryTime:`${pad(now.getHours())}:${pad(now.getMinutes())}`,injuryAddress:"",description:"",bodyPart:BODY_PARTS[0],medicalAttention:"",medicalProvider:"",missedWork:"",missedDays:"",witnesses:"",reportedBy:""});
  const [attachments,setAttachments]=useState(existing?.attachments||[]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const fmtSize=b=>b>1048576?`${(b/1048576).toFixed(1)}MB`:`${(b/1024).toFixed(0)}KB`;
  const handleFiles=e=>{Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=ev=>setAttachments(p=>[...p,{id:Date.now()+Math.random(),name:file.name,type:file.type,size:file.size,data:ev.target.result}]);r.readAsDataURL(file);});};
  const doSave=()=>{if(!form.employeeName)return alert("Please fill in Employee Name.");onSave({...form,attachments,id:existing?.id||Date.now().toString(),createdAt:existing?.createdAt||new Date().toISOString(),subject:`WORK RELATED INJURY - ${form.employeeName.toUpperCase()}`});};
  return <>
    <div style={{background:"#1a0a0a",border:"1px solid #6a1a1a",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
      <div style={{fontSize:10,color:"#cc5555",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Report Subject</div>
      <div style={{fontSize:14,color:"#ff9999",fontFamily:"'DM Mono',monospace",fontWeight:700}}>WORK RELATED INJURY — {form.employeeName?form.employeeName.toUpperCase():"[EMPLOYEE NAME]"}</div>
    </div>
    <div className="form-grid-2">
      <Field label="Terminal Location"><select style={IS} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>{TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
      <Field label="Reported By (Manager)"><input style={IS} value={form.reportedBy} onChange={e=>set("reportedBy",e.target.value)} placeholder="Manager name"/></Field>
      <Field label="Employee Full Name *"><input style={IS} value={form.employeeName} onChange={e=>set("employeeName",e.target.value)} placeholder="First and Last Name"/></Field>
      <Field label="Body Part Injured"><select style={IS} value={form.bodyPart} onChange={e=>set("bodyPart",e.target.value)}>{BODY_PARTS.map(b=><option key={b} value={b}>{b}</option>)}</select></Field>
      <Field label="Date of Injury"><input style={IS} type="date" value={form.injuryDate} onChange={e=>set("injuryDate",e.target.value)}/></Field>
      <Field label="Time of Injury"><input style={IS} type="time" value={form.injuryTime} onChange={e=>set("injuryTime",e.target.value)}/></Field>
    </div>
    <Field label="Address / Location of Injury" span><input style={IS} value={form.injuryAddress} onChange={e=>set("injuryAddress",e.target.value)} placeholder="Loading dock, Warehouse aisle 3, Parking lot..."/></Field>
    <Field label="Description of What Happened" span><textarea style={{...IS,height:90,resize:"vertical"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe the incident in detail..."/></Field>
    <div className="form-grid-2">
      <Field label="Medical Attention Received?">
        <select style={IS} value={form.medicalAttention} onChange={e=>set("medicalAttention",e.target.value)}>
          <option value="">— Select —</option>
          <option>No</option>
          <option value="Yes - On-site first aid">Yes — On-site first aid</option>
          <option value="Yes - Urgent care clinic">Yes — Urgent care clinic</option>
          <option value="Yes - Emergency room">Yes — Emergency room</option>
          <option value="Yes - Personal doctor">Yes — Personal doctor</option>
          <option value="Yes - Other">Yes — Other</option>
        </select>
      </Field>
      {form.medicalAttention&&form.medicalAttention!=="No"&&<Field label="Name / Location of Medical Provider"><input style={IS} value={form.medicalProvider} onChange={e=>set("medicalProvider",e.target.value)} placeholder="Clinic or doctor name and address"/></Field>}
      <Field label="Will Employee Miss Work?">
        <select style={IS} value={form.missedWork} onChange={e=>set("missedWork",e.target.value)}>
          <option value="">— Select —</option>
          <option value="No">No — returning same day</option>
          <option value="Unknown">Unknown — to be determined</option>
          <option value="Yes">Yes — missed or expected to miss work</option>
        </select>
      </Field>
      {form.missedWork==="Yes"&&<Field label="Days Missed (or Expected)"><input style={IS} type="number" min="1" value={form.missedDays} onChange={e=>set("missedDays",e.target.value)} placeholder="e.g. 3"/></Field>}
    </div>
    <Field label="Witnesses (Names or None)" span><textarea style={{...IS,height:60,resize:"vertical"}} value={form.witnesses} onChange={e=>set("witnesses",e.target.value)} placeholder="List witness names, or write 'None'..."/></Field>
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,marginBottom:8,textTransform:"uppercase",fontWeight:500}}>Attach Photos, Videos, Medical Documents</div>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#111124",border:"2px dashed #2e2e4a",borderRadius:8,padding:"14px 16px",marginBottom:10}}>
        <Ico n="attach" s={16}/><span style={{fontSize:13,color:"#7070a0",fontFamily:"'DM Mono',monospace"}}>Click to attach files (images, PDFs, videos)</span>
        <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFiles} style={{display:"none"}}/>
      </label>
      {attachments.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {attachments.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,background:"#0f0f22",border:"1px solid #1e1e38",borderRadius:6,padding:"8px 12px"}}>
            <span style={{fontSize:18}}>{a.type.startsWith("image")?"🖼️":a.type.startsWith("video")?"🎬":"📄"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:"#ccccee",fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
              <div style={{fontSize:10,color:"#6060a0",fontFamily:"'DM Mono',monospace"}}>{fmtSize(a.size)}</div>
            </div>
            {a.type.startsWith("image")&&<img src={a.data} alt={a.name} style={{width:40,height:40,objectFit:"cover",borderRadius:4,border:"1px solid #2a2a48"}}/>}
            <button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#ff5555",cursor:"pointer",padding:4,display:"flex"}}><Ico n="x" s={13}/></button>
          </div>
        ))}
      </div>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      <button style={{...B("danger"),display:"flex",alignItems:"center",gap:6}} onClick={doSave}><Ico n="medkit" s={14}/>{existing?"Update Report":"Submit Injury Report"}</button>
    </div>
  </>;
}

// ─── Injury Card ──────────────────────────────────────────────────────────────
function InjuryCard({report,onView,onEdit,onDelete}) {
  const t=TERMINAL_DATA[report.terminal]||{};
  return (
    <div className="card" style={{background:"#0d0d20",border:"1px solid #5a1a1a",borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
      <div style={{background:"#1a0707",border:"1px solid #6a1a1a",borderRadius:8,padding:"9px 13px",marginBottom:12}}>
        <div style={{fontSize:10,color:"#cc5555",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Work Related Injury Report</div>
        <div style={{fontSize:16,fontWeight:800,color:"#ff9999",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>{report.employeeName}</div>
      </div>
      <div style={{fontSize:12,color:"#8888aa",fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
        <div style={{color:"#5599cc"}}>📍 {report.terminal}</div>
        <div style={{color:"#4a6a80",paddingLeft:18}}>{t.address}</div>
        <div>📅 {report.injuryDate?new Date(report.injuryDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}):""} · ⏰ {report.injuryTime}</div>
        <div>🩹 <span style={{color:"#cc9999"}}>{report.bodyPart}</span></div>
        {report.medicalAttention&&<div>🏥 {report.medicalAttention}{report.medicalProvider?` — ${report.medicalProvider}`:""}</div>}
        {report.missedWork==="Yes"&&<div style={{color:"#ffaa44"}}>⚠️ Missed {report.missedDays||"?"} day(s)</div>}
        {report.missedWork==="No"&&<div style={{color:"#44aa77"}}>✅ No missed days</div>}
      </div>
      {report.description&&<div style={{background:"#0a0a1e",borderRadius:7,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#9090aa",fontFamily:"'DM Mono',monospace",lineHeight:1.65,border:"1px solid #1e1e38"}}>{report.description.length>120?report.description.slice(0,120)+"…":report.description}</div>}
      {report.attachments?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {report.attachments.slice(0,4).map((a,i)=>a.type.startsWith("image")?<img key={i} src={a.data} alt={a.name} style={{width:48,height:48,objectFit:"cover",borderRadius:5,border:"1px solid #2a2a48"}}/>:<div key={i} style={{width:48,height:48,background:"#14142a",border:"1px solid #2a2a48",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{a.type.startsWith("video")?"🎬":"📄"}</div>)}
        {report.attachments.length>4&&<div style={{width:48,height:48,background:"#14142a",border:"1px solid #2a2a48",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#6060a0",fontFamily:"'DM Mono',monospace"}}>+{report.attachments.length-4}</div>}
      </div>}
      <div style={{fontSize:10,color:"#4a4a78",fontFamily:"'DM Mono',monospace",marginBottom:12}}>Filed {new Date(report.createdAt).toLocaleDateString()} · By: {report.reportedBy||t.manager}</div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>onView(report)} style={{...B("ghost"),padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Ico n="eye" s={12}/>View Full</button>
        <button onClick={()=>onEdit(report)} style={{...B("ghost"),padding:"5px 12px",fontSize:12}}>Edit</button>
        <button onClick={()=>onDelete(report.id)} style={{...B("ghost"),padding:"5px 8px",marginLeft:"auto",color:"#ff5555"}}><Ico n="trash" s={13}/></button>
      </div>
    </div>
  );
}

// ─── Injury Detail ────────────────────────────────────────────────────────────
function InjuryDetail({report,onClose}) {
  const t=TERMINAL_DATA[report.terminal]||{};
  const [lb,setLb]=useState(null);
  const R=({label,value})=>value?(
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>{label}</div>
      <div style={{fontSize:14,color:"#ccccee",fontFamily:"'DM Mono',monospace",lineHeight:1.65}}>{value}</div>
    </div>
  ):null;
  return (
    <Modal title="Full Injury Report" onClose={onClose} wide>
      <div style={{background:"#1a0707",border:"1px solid #8a2020",borderRadius:8,padding:"12px 16px",marginBottom:18}}>
        <div style={{fontSize:11,color:"#cc5555",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,marginBottom:4}}>SUBJECT</div>
        <div style={{fontSize:17,fontWeight:800,color:"#ff9999",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>WORK RELATED INJURY — {report.employeeName?.toUpperCase()}</div>
      </div>
      <div className="inj-detail-grid">
        <R label="Terminal"           value={report.terminal}/>
        <R label="Reported By"        value={report.reportedBy||t.manager}/>
        <R label="Employee Full Name" value={report.employeeName}/>
        <R label="Body Part Injured"  value={report.bodyPart}/>
        <R label="Date of Injury"     value={report.injuryDate?new Date(report.injuryDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}):null}/>
        <R label="Time of Injury"     value={report.injuryTime}/>
      </div>
      <R label="Address / Location of Injury" value={report.injuryAddress}/>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Description of What Happened</div>
        <div style={{fontSize:13,color:"#ccccee",fontFamily:"'DM Mono',monospace",lineHeight:1.75,background:"#0a0a1e",border:"1px solid #1e1e38",borderRadius:7,padding:"10px 14px"}}>{report.description||"—"}</div>
      </div>
      <div className="inj-detail-grid">
        <R label="Medical Attention" value={report.medicalAttention||"Not specified"}/>
        {report.medicalProvider&&<R label="Medical Provider" value={report.medicalProvider}/>}
        <R label="Missed Work"       value={report.missedWork||"Not specified"}/>
        {report.missedDays&&<R label="Days Missed" value={`${report.missedDays} day(s)`}/>}
      </div>
      <R label="Witnesses" value={report.witnesses||"None reported"}/>
      {report.attachments?.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:"#7878a8",fontFamily:"'DM Mono',monospace",letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>Attachments ({report.attachments.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {report.attachments.map((a,i)=>(
              <div key={i} onClick={()=>a.type.startsWith("image")&&setLb(a)} style={{cursor:a.type.startsWith("image")?"pointer":"default"}}>
                {a.type.startsWith("image")
                  ?<img src={a.data} alt={a.name} style={{width:80,height:80,objectFit:"cover",borderRadius:6,border:"1px solid #2a2a48"}}/>
                  :<a href={a.data} download={a.name} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"#111124",border:"1px solid #2a2a48",borderRadius:6,padding:"10px 14px",textDecoration:"none"}}><span style={{fontSize:28}}>{a.type.startsWith("video")?"🎬":"📄"}</span><span style={{fontSize:10,color:"#7070a0",fontFamily:"'DM Mono',monospace",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span></a>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{fontSize:11,color:"#5050a0",fontFamily:"'DM Mono',monospace"}}>Filed: {new Date(report.createdAt).toLocaleString()}</div>
      {lb&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.96)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLb(null)}>
          <img src={lb.data} alt={lb.name} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:8,objectFit:"contain"}}/>
          <button onClick={()=>setLb(null)} style={{position:"absolute",top:20,right:20,background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:28}}>✕</button>
        </div>
      )}
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
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,4,18,0.82)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)"}}>
      <div style={{background:"rgba(13,13,30,0.97)",border:"1px solid #28284a",borderRadius:18,padding:"40px 36px",width:"100%",maxWidth:400,boxShadow:"0 40px 100px rgba(0,0,0,0.85)",animation:"slideIn .25s ease"}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:32}}>
          <div style={{background:"#ff6200",borderRadius:9,padding:"8px 11px",display:"flex",flexShrink:0}}><Ico n="truck" s={22}/></div>
          <div>
            <div style={{fontSize:21,fontWeight:800,letterSpacing:1.2,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif",lineHeight:1}}>PND LOGISTICS</div>
            <div style={{fontSize:10,color:"#6060a0",fontFamily:"'DM Mono',monospace",letterSpacing:1.4,marginTop:3}}>MANAGEMENT PORTAL</div>
          </div>
        </div>
        <Field label="Username">
          <input style={IS} value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={onKey} placeholder="Enter your username" autoFocus/>
        </Field>
        <Field label="Password">
          <input style={IS} type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKey} placeholder="Enter your password"/>
        </Field>
        {error&&<div style={{color:"#ff7777",fontSize:12,fontFamily:"'DM Mono',monospace",marginBottom:14,background:"#1a0707",border:"1px solid #4a1a1a",borderRadius:7,padding:"9px 12px"}}>{error}</div>}
        <button onClick={doLogin} disabled={loading} style={{...B("primary"),width:"100%",marginTop:4,fontSize:16,padding:"12px 18px",letterSpacing:.8,opacity:loading?.65:1,transition:"opacity .2s"}}>
          {loading?"Signing in…":"Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── User Form (admin) ────────────────────────────────────────────────────────
function UserForm({ onSave, onClose, existing }) {
  const isAdminUser = existing?.username === "admin";
  const [form, setForm] = useState(existing ? {
    name: existing.name, username: existing.username, password: "",
    role: existing.role, terminal: existing.terminal||"",
    phone: existing.phone||"", email: existing.email||"", status: existing.status,
  } : { name:"", username:"", password:"", role:"user", terminal:"", phone:"", email:"", status:"active" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const doSave = () => {
    if (!form.name||!form.username) return alert("Name and username are required.");
    if (!existing && !form.password) return alert("Password is required for new users.");
    onSave(form);
  };

  return <>
    <div className="form-grid-2">
      <Field label="Full Name *"><input style={IS} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Jane Smith"/></Field>
      <Field label="Username *"><input style={IS} value={form.username} onChange={e=>set("username",e.target.value)} placeholder="jsmith" disabled={isAdminUser}/></Field>
      <Field label={existing?"New Password (blank = keep current)":"Password *"}>
        <input style={IS} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder={existing?"Leave blank to keep current":"Set a password"}/>
      </Field>
      <Field label="Role">
        <select style={IS} value={form.role} onChange={e=>set("role",e.target.value)} disabled={isAdminUser}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field label="Terminal Location">
        <select style={IS} value={form.terminal} onChange={e=>set("terminal",e.target.value)}>
          <option value="">— Not assigned —</option>
          {TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select style={IS} value={form.status} onChange={e=>set("status",e.target.value)} disabled={isAdminUser}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>
      <Field label="Email"><input style={IS} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="jane@example.com"/></Field>
      <Field label="Phone Number"><input style={IS} value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 (555) 000-0000"/></Field>
    </div>
    {isAdminUser&&<div style={{fontSize:11,color:"#ffaa55",fontFamily:"'DM Mono',monospace",marginBottom:12,background:"#2a1a00",border:"1px solid #7a4400",borderRadius:6,padding:"8px 12px"}}>⚠️ Master admin account — username, role and status cannot be changed.</div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
      <button style={B("ghost")} onClick={onClose}>Cancel</button>
      <button style={B("primary")} onClick={doSave}>{existing?"Update User":"Create User"}</button>
    </div>
  </>;
}

// ─── User Card (admin) ────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy" style={{background:"none",border:"none",padding:"0 4px",cursor:"pointer",color:copied?"#00ee77":"#5050a0",fontSize:11,fontFamily:"'DM Mono',monospace",lineHeight:1}}>
      {copied ? "✓" : "⎘"}
    </button>
  );
}

function UserCard({ user, onEdit, isSelf }) {
  const isAdminUser = user.role === "admin";
  return (
    <div className="card" style={{background:"#0d0d20",border:`1px solid ${isAdminUser?"#3a2060":"#262642"}`,borderRadius:12,padding:18,boxShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#eeeeff",fontFamily:"'Barlow Condensed',sans-serif"}}>{user.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:2,marginTop:2}}>
            <span style={{fontSize:11,color:"#7070a8",fontFamily:"'DM Mono',monospace"}}>@{user.username}</span>
            <CopyBtn value={user.username}/>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
          <span style={{background:isAdminUser?"#2a1a4a":"#141428",color:isAdminUser?"#bb88ff":"#7878a8",border:`1px solid ${isAdminUser?"#4a2a7a":"#252548"}`,padding:"2px 10px",borderRadius:99,fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500}}>
            {user.role.toUpperCase()}
          </span>
          <span style={{background:user.status==="active"?"#0a2a18":"#2a0d0d",color:user.status==="active"?"#00ee77":"#ff5555",border:`1px solid ${user.status==="active"?"#1a6a3a":"#7a2020"}`,padding:"2px 10px",borderRadius:99,fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500}}>
            {user.status}
          </span>
        </div>
      </div>
      <div style={{fontSize:12,color:"#7878a8",fontFamily:"'DM Mono',monospace",display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:2}}>
          <span style={{color:"#5050a0"}}>🔑</span>
          <span style={{letterSpacing:2}}>{"•".repeat(user.password?.length||6)}</span>
          <CopyBtn value={user.password||""}/>
        </div>
        {user.terminal&&<div style={{color:"#5599cc"}}>📍 {user.terminal}</div>}
        {user.email&&<div>✉️ {user.email}</div>}
        {user.phone&&<div>📞 {user.phone}</div>}
        {isSelf&&<div style={{color:"#ffaa55",marginTop:2}}>👤 Currently logged in</div>}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>onEdit(user)} style={{...B("ghost"),padding:"5px 12px",fontSize:12}}>Edit</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [currentUser,  setCurrentUser]  = useState(null);
  const [authChecked,  setAuthChecked]  = useState(false);
  const [users,        setUsers]        = useState([]);

  useEffect(()=>{ setCurrentUser(getSession()); setAuthChecked(true); },[]);

  const handleLogin  = useCallback(user => setCurrentUser(user), []);
  const handleLogout = useCallback(()=>{ logout(); setCurrentUser(null); },[]);

  const loadUsers = useCallback(async()=>{
    const data = await fetchUsers();
    setUsers(data);
  },[]);

  useEffect(()=>{ if(currentUser?.role==="admin") loadUsers(); },[currentUser,loadUsers]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tab,setTab]=useState("rt");
  const [rts,setRts]=useState([]);
  const [unis,setUnis]=useState([]);
  const [trucks,setTrucks]=useState([]);
  const [injs,setInjs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [toasts,setToasts]=useState([]);
  const [fTerm,setFTerm]=useState("All");
  const [fStatus,setFStatus]=useState("All");
  const [lastSync,setLastSync]=useState(null);
  const [syncing,setSyncing]=useState(false);

  const toast=useCallback((msg,type="info")=>{const id=Date.now();setToasts(t=>[...t,{id,message:msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);},[]);

  const loadAll=useCallback(async()=>{
    const [a,b,c,d]=await Promise.all([dbLoad(SK.rt),dbLoad(SK.uni),dbLoad(SK.tr),dbLoad(SK.inj)]);
    setRts(a);setUnis(b);setTrucks(c);setInjs(d);setLastSync(new Date());setLoading(false);
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
    const result=await sendRoadTestOutcomeEmail(test);
    if(result?.ok) toast("📧 Outcome email sent to "+test.createdBy.name+".","success");
    else if(result?.error) toast("Email failed to send. Check console.","warn");
  };

  const saveUni=async req=>{const isNew=!unis.some(u=>u.id===req.id);const upd=isNew?[...unis,req]:unis.map(u=>u.id===req.id?req:u);setUnis(upd);toast("Uniform order saved!","success");setModal(null);dbSave(SK.uni,upd);};
  const delUni=async id=>{if(!confirm("Delete?"))return;const upd=unis.filter(u=>u.id!==id);setUnis(upd);toast("Removed.");dbSave(SK.uni,upd);};
  const fulfillUni=async id=>{const upd=unis.map(u=>u.id===id?{...u,status:"Completed",fulfilledAt:new Date().toISOString()}:u);setUnis(upd);toast("✅ Order fulfilled!","success");dbSave(SK.uni,upd);};

  const saveTruck=async truck=>{const isNew=!trucks.some(t=>t.id===truck.id);const upd=isNew?[...trucks,truck]:trucks.map(t=>t.id===truck.id?truck:t);setTrucks(upd);toast(isNew?"🚚 Truck added!":"Truck updated.","success");setModal(null);dbSave(SK.tr,upd);};
  const delTruck=async id=>{if(!confirm("Remove truck?"))return;const upd=trucks.filter(t=>t.id!==id);setTrucks(upd);toast("Truck removed.");dbSave(SK.tr,upd);};

  const saveInj=async r=>{const isNew=!injs.some(x=>x.id===r.id);const upd=isNew?[...injs,r]:injs.map(x=>x.id===r.id?r:x);setInjs(upd);toast(isNew?"🚨 Injury report filed.":"Report updated.","warn");setModal(null);dbSave(SK.inj,upd);};
  const delInj=async id=>{if(!confirm("Delete this injury report?"))return;const upd=injs.filter(r=>r.id!==id);setInjs(upd);toast("Report deleted.");dbSave(SK.inj,upd);};

  const pendingOut=rts.filter(r=>{const e=new Date(`${r.date}T${r.time}`);e.setMinutes(e.getMinutes()+parseInt(r.duration||60));return new Date()>=e&&r.status==="Scheduled";}).length;
  const truckAlerts=trucks.filter(t=>(expStatus(t.regExpiry)!=="ok"&&expStatus(t.regExpiry)!=="none")||(expStatus(t.inspExpiry)!=="ok"&&expStatus(t.inspExpiry)!=="none")).length;

  const fRts   =rts.filter(r=>(fTerm==="All"||r.terminal===fTerm)&&(fStatus==="All"||r.status===fStatus)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fUnis  =unis.filter(u=>fTerm==="All"||u.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const fTrucks=trucks.filter(t=>fTerm==="All"||t.terminal===fTerm).sort((a,b)=>{const u=x=>{const r=expStatus(x.regExpiry),i=expStatus(x.inspExpiry);if(r==="expired"||i==="expired")return 0;if(r==="warning"||i==="warning")return 1;return 2;};return u(a)-u(b);});
  const fInjs  =injs.filter(r=>fTerm==="All"||r.terminal===fTerm).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const TABS=[
    {key:"rt",    icon:"clip",   label:"Road Tests",     count:rts.filter(r=>r.status==="Scheduled").length, badgeColor:"#ff6200"},
    {key:"uni",   icon:"shirt",  label:"Uniform Orders", count:unis.filter(u=>u.status==="Pending").length,  badgeColor:"#ff6200"},
    {key:"fleet", icon:"fleet",  label:"Fleet",          count:truckAlerts,                                   badgeColor:"#cc6600"},
    {key:"inj",   icon:"medkit", label:"Injury Reports", count:injs.length,                                   badgeColor:"#aa1111"},
    ...(currentUser?.role==="admin"?[{key:"users",icon:"user",label:"Users",count:0,badgeColor:"#ff6200"}]:[]),
  ];

  const addLabel={rt:"Schedule Road Test",uni:"New Uniform Request",fleet:"Add Truck",inj:"File Injury Report",users:"Add User"};
  const addType ={rt:"newRT",uni:"newUni",fleet:"newTruck",inj:"newInj",users:"newUser"};

  const STATS=[
    {l:"Total Tests",    v:rts.length,                                    c:"#7070a8"},
    {l:"Scheduled",      v:rts.filter(r=>r.status==="Scheduled").length,  c:"#4db8ff"},
    {l:"Passed",         v:rts.filter(r=>r.status==="Passed").length,     c:"#00ee77"},
    {l:"Failed",         v:rts.filter(r=>r.status==="Failed").length,     c:"#ff6666"},
    {l:"Pending Orders", v:unis.filter(u=>u.status==="Pending").length,   c:"#ffcc44"},
    {l:"Fleet Alerts",   v:truckAlerts,                                    c:"#ffaa00"},
    {l:"Total Trucks",   v:trucks.length,                                  c:"#8888b0"},
    {l:"Injury Reports", v:injs.length,                                    c:"#ff8888"},
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

  if (!authChecked) return (
    <div style={{minHeight:"100vh",background:"#080812",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"#5050a0",fontFamily:"'DM Mono',monospace",fontSize:13}}>Loading…</span>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 30% 0%, #10102a 0%, #080812 65%)",fontFamily:"'Barlow Condensed',sans-serif",color:"#eeeeff"}}>

      {/* ── AUTH MODAL ─────────────────────────────────────── */}
      {!currentUser && <AuthModal onLogin={handleLogin}/>}

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="app-header" style={{background:"#0b0b1e",borderBottom:"1px solid #1e1e38"}}>
        <div className="header-inner">
          <div className="header-top">
            <div className="header-brand">
              <div style={{background:"#ff6200",borderRadius:8,padding:"7px 10px",display:"flex",flexShrink:0}}><Ico n="truck" s={20}/></div>
              <div>
                <div className="brand-title">PND LOGISTICS MANAGEMENT</div>
                <div className="brand-sub">ROAD TESTS · UNIFORMS · FLEET · INJURY REPORTS · 6 TERMINALS</div>
              </div>
            </div>
            <div className="header-actions">
              {pendingOut>0&&<div style={{background:"#2a1200",border:"1px solid #ff6200",borderRadius:7,padding:"5px 10px",display:"flex",alignItems:"center",gap:5,animation:"pulse 2s infinite"}}><Ico n="bell" s={13}/><span style={{fontSize:12,color:"#ffaa55",fontFamily:"'DM Mono',monospace"}}>{pendingOut} awaiting outcome</span></div>}
              <button onClick={handleSync} disabled={syncing} style={{...B("ghost"),padding:"6px 10px",display:"flex",alignItems:"center",gap:5,fontSize:12,opacity:syncing?.5:1,transition:"opacity .2s"}}><span style={{display:"inline-flex",animation:syncing?"spin 1s linear infinite":"none"}}><Ico n="refresh" s={13}/></span>{syncing?"Syncing…":"Sync"}</button>
              {lastSync&&<span className="sync-label" style={{fontSize:10,color:"#5050a0",fontFamily:"'DM Mono',monospace"}}>{lastSync.toLocaleTimeString()}</span>}
              {currentUser&&(
                <div style={{display:"flex",alignItems:"center",gap:8,borderLeft:"1px solid #1e1e38",paddingLeft:10,marginLeft:2}}>
                  <span style={{fontSize:11,color:"#7070a8",fontFamily:"'DM Mono',monospace",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</span>
                  <button onClick={handleLogout} style={{background:"#1c1c32",border:"1px solid #2e2e4a",color:"#9090b8",padding:"5px 10px",borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:.5}}>Logout</button>
                </div>
              )}
            </div>
          </div>
          <div className="tabs-row">
            {TABS.map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)} style={{borderBottomColor:tab===t.key?"#ff6200":"transparent",color:tab===t.key?"#ff6200":"#7070a8"}}>
                <Ico n={t.icon} s={15}/>{t.label}
                {t.count>0&&<span style={{background:t.badgeColor,color:"#fff",borderRadius:99,padding:"1px 8px",fontSize:10,fontWeight:700}}>{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <div className="stats-bar" style={{background:"#0b0b1e",borderBottom:"1px solid #161630"}}>
        <div className="stats-inner">
          {STATS.map(s=>(
            <div key={s.l} className="stat-item">
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#6868a8",textTransform:"uppercase",letterSpacing:.8}}>{s.l}</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:s.c,lineHeight:1}}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div className="main-wrap">
        <div className="filter-bar">
          {tab!=="users"&&<select style={{...IS,width:"auto",minWidth:200}} value={fTerm} onChange={e=>setFTerm(e.target.value)}>
            <option value="All">All Terminals</option>
            {TERMINALS.map(t=><option key={t} value={t}>{t}</option>)}
          </select>}
          {tab==="rt"&&<select style={{...IS,width:"auto"}} value={fStatus} onChange={e=>setFStatus(e.target.value)}>{["All","Scheduled","Passed","Failed"].map(s=><option key={s} value={s}>{s}</option>)}</select>}
          <button onClick={()=>downloadCSV(tab,{rt:rts,uni:unis,fleet:trucks,inj:injs,users}[tab])} style={{...B("ghost"),display:"flex",alignItems:"center",gap:6,marginLeft:"auto",padding:"6px 14px",fontSize:12}}>
            <Ico n="dl" s={14}/><span className="sync-label">Download CSV</span>
          </button>
          <button className="add-btn" onClick={()=>setModal({type:addType[tab]})} style={{...B(tab==="inj"?"danger":"primary"),display:"flex",alignItems:"center",gap:6}}>
            <Ico n="plus" s={14}/>{addLabel[tab]}
          </button>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace"}}>Loading shared data…</div>
        ) : tab==="rt" ? (
          fRts.length===0
            ?<div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace",fontSize:13}}>No road tests yet. Click "Schedule Road Test" to begin.</div>
            :<div className="cards-grid">{fRts.map(t=><RTCard key={t.id} test={t} onEdit={t=>setModal({type:"editRT",data:t})} onOutcome={t=>setModal({type:"outcome",data:t})} onDelete={delRT} onSms={t=>setModal({type:"sms",data:t})}/>)}</div>
        ) : tab==="uni" ? (
          fUnis.length===0
            ?<div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace",fontSize:13}}>No uniform requests yet.</div>
            :<div className="cards-grid">{fUnis.map(u=><UniCard key={u.id} req={u} onEdit={r=>setModal({type:"editUni",data:r})} onDelete={delUni} onFulfill={fulfillUni}/>)}</div>
        ) : tab==="fleet" ? (<>
          {truckAlerts>0&&<div style={{background:"#1e1000",border:"1px solid #7a4400",borderRadius:9,padding:"11px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}><Ico n="warn" s={16}/><span style={{fontSize:14,color:"#ffcc44",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{truckAlerts} truck{truckAlerts>1?"s":""} require attention — registration or inspection expiring soon / expired</span></div>}
          {fTrucks.length===0
            ?<div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace",fontSize:13}}>No trucks yet. Click "Add Truck" to begin.</div>
            :<div className="cards-grid-wide">{fTrucks.map(t=><TruckCard key={t.id} truck={t} onEdit={t=>setModal({type:"editTruck",data:t})} onDelete={delTruck}/>)}</div>}
        </>) : tab==="users" ? (
          users.length===0
            ?<div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace",fontSize:13}}>No users yet. Click "Add User" to create one.</div>
            :<div className="cards-grid-wide">{users.map(u=><UserCard key={u.id} user={u} onEdit={u=>setModal({type:"editUser",data:u})} isSelf={u.id===currentUser?.id}/>)}</div>
        ) : (
          fInjs.length===0
            ?<div style={{textAlign:"center",padding:80,color:"#5a5a9a",fontFamily:"'DM Mono',monospace",fontSize:13}}>No injury reports filed yet. Click "File Injury Report" to begin.</div>
            :<div className="cards-grid-wide">{fInjs.map(r=><InjuryCard key={r.id} report={r} onView={r=>setModal({type:"viewInj",data:r})} onEdit={r=>setModal({type:"editInj",data:r})} onDelete={delInj}/>)}</div>
        )}
      </div>

      {/* ── MODALS ─────────────────────────────────────────── */}
      {modal?.type==="newRT"     && <Modal title="Schedule Road Test"        onClose={()=>setModal(null)} wide><RTForm      onSave={saveRT}      onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editRT"    && <Modal title="Edit Road Test"            onClose={()=>setModal(null)} wide><RTForm      onSave={saveRT}      onClose={()=>setModal(null)} existing={modal.data}/></Modal>}
      {modal?.type==="outcome"   && <Modal title="Enter Road Test Outcome"   onClose={()=>setModal(null)}     ><OutcomeForm onSave={saveOutcome} onClose={()=>setModal(null)} test={modal.data}/></Modal>}
      {modal?.type==="sms"       && <SmsModal test={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newUni"    && <Modal title="New Uniform Order"         onClose={()=>setModal(null)} wide><UniForm    onSave={saveUni}     onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editUni"   && <Modal title="Edit Uniform Request"      onClose={()=>setModal(null)} wide><UniForm    onSave={saveUni}     onClose={()=>setModal(null)} existing={modal.data}/></Modal>}
      {modal?.type==="newTruck"  && <Modal title="Add Truck to Fleet"        onClose={()=>setModal(null)} wide><TruckForm  onSave={saveTruck}   onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editTruck" && <Modal title="Edit Truck"                onClose={()=>setModal(null)} wide><TruckForm  onSave={saveTruck}   onClose={()=>setModal(null)} existing={modal.data}/></Modal>}
      {modal?.type==="newInj"    && <Modal title="File Work Injury Report"   onClose={()=>setModal(null)} wide><InjuryForm onSave={saveInj}     onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editInj"   && <Modal title="Edit Injury Report"        onClose={()=>setModal(null)} wide><InjuryForm onSave={saveInj}     onClose={()=>setModal(null)} existing={modal.data}/></Modal>}
      {modal?.type==="viewInj"   && <InjuryDetail report={modal.data} onClose={()=>setModal(null)}/>}
      {modal?.type==="newUser"   && <Modal title="Create User"         onClose={()=>setModal(null)} wide><UserForm onSave={handleSaveUser} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==="editUser"  && <Modal title="Edit User"           onClose={()=>setModal(null)} wide><UserForm onSave={handleSaveUser} onClose={()=>setModal(null)} existing={modal.data}/></Modal>}

      <Toast toasts={toasts}/>
    </div>
  );
}
