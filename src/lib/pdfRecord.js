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

export async function generateRoadTestPDF(test, terminalData, adminUser) {
  const response = await fetch("/docs/OP104PDrev111320.pdf");
  if (!response.ok) throw new Error("Could not load PDF template.");
  const existingPdfBytes = await response.arrayBuffer();

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const dateStr = formatDate(test.date);
  const startTime = formatTime12(test.time);
  const endTime = addMinutes(test.time, test.duration);

  // ── Draw text helper ────────────────────────────────────────────────────────
  const draw = (text, x, y, size = 10) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
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
  draw(dateStr, 72, 612);                        // Date
  draw(test.candidateName || "", 110, 594);       // Driver Name
  draw(test.fedexId || "", 500, 594);             // Driver FedEx ID
  draw(adminUser?.name || "", 175, 576);           // Road Test Administrator Name
  draw(adminUser?.fedex_id || "", 500, 576);       // Road Test Administrator FedEx ID

  // ── Section 2 — Employer fields from pdf-general-fields.json ──────────────
  // These fields have no underline rects in this PDF revision; text is placed
  // in the three blank strips between Section 1/2 separator and signature line.
  // y=557: between thick separator (y=563) and "SECTION 2:" header (y=554)
  // y=537: between "(LEAVE BLANK)" note (y=544) and cert text (y=529)
  // y=512: between cert text line 2 (y=520) and signature underline (y=501)
  const gf = generalFields[test.terminal] || {};
  const getField = key => gf[key] || gf[key.replace("'", "’")] || gf[key.replace("’", "'")] || "";
  draw(getField("Road Test Administrator Employer's Name"), 36, 557, 8);
  draw(getField("Road Test Administrator Employer's Business Address"), 36, 537, 8);
  draw(getField("City"), 36, 512, 8);
  draw(getField("State"), 210, 512, 8);
  draw(getField("ZIP Code"), 320, 512, 8);

  // ── Section 3 ──────────────────────────────────────────────────────────────
  draw(startTime, 414, 436, 8);                      // Test Time From
  draw(endTime, 463, 436, 8);                        // Test Time To
  draw(dateStr, 514, 436, 8);                        // Date

  // ── Section 3 — Satisfactory checkboxes ───────────────────────────────────
  // 8 evaluation items: 4 rows x 2 columns. Left col x:41, right col x:320.
  // Satisfactory = first checkbox in each pair (Not Satisfactory = x:113 / x:392).
  const satisfactoryY = [392.0, 352.1, 311.9, 271.6];   // left column
  const satisfactoryYR = [392.0, 351.9, 311.8, 271.6];  // right column
  satisfactoryY.forEach(y => check(41.0, y));
  satisfactoryYR.forEach(y => check(320.0, y));

  // ── Section 4 ──────────────────────────────────────────────────────────────
  draw(test.candidateName || "", 112, 227);       // Driver Name
  draw(test.fedexId || "", 500, 227);             // Driver FedEx ID
  draw(test.dln || "", 128, 210);                 // Driver's License Number
  draw(test.dlnState || "", 478, 210);            // DLN State
  draw(dateStr, 404, 154);                        // Certification date

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
