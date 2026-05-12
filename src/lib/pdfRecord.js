import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import generalFields from "../../docs/pdf-general-fields.json";

// All coordinates are in PDF space: x from left, y from bottom (pt units).
// Page size: 612 x 792 pts. Checkbox font F4 (Wingdings) size 8.04pt.

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${m}/${d}/${y}`;
}

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const normalized = timeStr.trim().replace(/\s*([AaPp][Mm])$/u, " $1");
  const match = normalized.match(/^\s*(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?\s*$/u);
  if (!match) return null;
  let [, hourStr, minuteStr, ampm] = match;
  let hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (isNaN(hour) || isNaN(minute)) return null;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === "PM" && hour < 12) hour += 12;
    if (upper === "AM" && hour === 12) hour = 0;
  }
  return { hour, minute };
}

function formatTime12(timeStr) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return "";
  const { hour, minute } = parsed;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute < 10 ? "0" : ""}${minute}${ampm}`;
}

function addMinutes(timeStr, minutes) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return "";
  const total = parsed.hour * 60 + parsed.minute + parseInt(minutes || 60, 10);
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const eh = Math.floor(wrapped / 60);
  const em = wrapped % 60;
  return formatTime12(`${eh}:${em < 10 ? "0" : ""}${em}`);
}

export async function generateRoadTestPDF(test, terminalData, adminUser, terminalPdfUrl) {
  const pdfSrc = terminalPdfUrl || "/docs/OP104PDrev111320.pdf";
  const response = await fetch(pdfSrc);
  if (!response.ok) throw new Error("Could not load PDF template for this terminal.");
  const existingPdfBytes = await response.arrayBuffer();

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const dateStr = formatDate(test.date);
  const startTime = formatTime12(test.time);
  const endTime = addMinutes(test.time, test.duration);

  const now = new Date();
  const todayStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;

  // ── Draw text helper ────────────────────────────────────────────────────────
  const draw = (text, x, y, size = 10) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
  };

  const splitDateValues = dateStr => {
    if (!dateStr) return ["", "", ""];
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return [m || "", d || "", y || ""];
    }
    return ["", "", ""];
  };

  const drawDateParts = (dateStr, xMonth, xDay, xYear, y, size = 8) => {
    const [month, day, year] = splitDateValues(dateStr);
    console.log(`Drawing date parts: ${month}/${day}/${year} at positions: ${xMonth}, ${xDay}, ${xYear}`);
    if (month) draw(month, xMonth, y, size);
    if (day) draw(day, xDay, y, size);
    if (year) draw(year, xYear, y, size);
  };

  // ── Check box helper — draws a solid 5x5 square inside the checkbox outline ─
  // Checkbox baseline y from PDF stream; box glyph is ~8pt tall, drawn 1pt inside.
  const check = (x, y) => {
    page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: 5.5,
      height: 5.5,
      color: rgb(0, 0, 0),
    });
  };

  // ── Section 1 ──────────────────────────────────────────────────────────────
  drawDateParts(dateStr, 61, 82, 100, 614, 10);     // Date (MM/DD/YYYY)
  draw(test.candidateName || "", 110, 596);       // Driver Name
  draw(test.fedexId || "", 500, 596);             // Driver FedEx ID
  draw(adminUser?.name || "", 175, 578);           // Road Test Administrator Name
  draw(adminUser?.fedex_id || "", 500, 578);       // Road Test Administrator FedEx ID

  // ── Section 2 ──────────────────────────────────────────────────────────────
  drawDateParts(dateStr, 480, 500, 520, 502, 8);     // Date (MM/DD/YYYY)

  // ── Section 3 ──────────────────────────────────────────────────────────────
  draw(startTime, 422, 437, 8);                      // Test Time From
  draw(endTime, 463, 437, 8);                        // Test Time To
  drawDateParts(dateStr, 520, 540, 557, 437, 8);     // Date (MM/DD/YYYY)

  // ── Section 3 — Satisfactory checkboxes ───────────────────────────────────
  // 8 evaluation items: 4 rows x 2 columns. Left col x:41, right col x:320.
  // Satisfactory = first checkbox in each pair (Not Satisfactory = x:113 / x:392).
  const satisfactoryY = [392.0, 352.1, 311.9, 271.6];   // left column
  const satisfactoryYR = [392.0, 351.9, 311.8, 271.6];  // right column
  satisfactoryY.forEach(y => check(41.0, y));
  satisfactoryYR.forEach(y => check(320.0, y));

  // ── Section 4 — Employer fields from pdf-general-fields.json ──────────────
  const gf = generalFields[test.terminal] || {};
  const normalizeFieldKey = key => String(key).replace(/[’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const getField = key => {
    if (key in gf) return gf[key] || "";
    const normalizedKey = normalizeFieldKey(key);
    const match = Object.keys(gf).find(k => normalizeFieldKey(k) === normalizedKey);
    return match ? gf[match] || "" : "";
  };
  draw(getField("Road Test Administrator Employer's Name"), 240, 103, 8);
  draw(getField("Road Test Administrator Employer's Business Address"), 240, 83, 8);
  draw(getField("City"), 370, 83, 8);
  draw(getField("State"), 470, 83, 8);
  draw(getField("ZIP Code"), 540, 83, 8);

  // ── Section 4 ──────────────────────────────────────────────────────────────
  draw("22", 45, 146, 8);                        // Route length (approximately ___ miles)
  draw(test.candidateName || "", 115, 229);       // Driver Name
  draw(test.fedexId || "", 500, 229);             // Driver FedEx ID
  draw(test.dln || "", 129, 210);                 // Driver's License Number
  draw(test.dlnState || "", 478, 210);            // DLN State
  draw(adminUser?.fedex_id || "", 478, 120);      // Road Test Administrator FedEx ID
  draw(test.default_unit_number || "", 320, 174);   // Vehicle/Unit Number (from terminal default)
  drawDateParts(dateStr, 408, 428, 443, 156, 8);     // Certification date (MM/DD/YYYY)

  // ── Type of Power Unit: P-1000 (x:351.1, y:191.9) ─────────────────────────
  check(351.1, 191.9);

  // ── Transmission Type: Automatic (x:166.6, y:173.7) ───────────────────────
  check(166.6, 173.7);

  // ── Save and trigger download ───────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RoadTest_${(test.candidateName || "record").replace(/\s+/g, "_")}_${test.date || "nodate"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
