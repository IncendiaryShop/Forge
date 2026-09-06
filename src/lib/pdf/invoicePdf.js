import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { computeTotals, currencySymbol, isPartyBlank } from "../../utils/invoiceCalc";

const ACCENT_DARK = rgb(0x5b / 255, 0x3f / 255, 0xb0 / 255);
const ACCENT_BG = rgb(0xe9 / 255, 0xe4 / 255, 0xfb / 255);
const PANEL_BG = rgb(0xf6 / 255, 0xf6 / 255, 0xfa / 255);
const TABLE_HEAD_BG = rgb(0xf2 / 255, 0xf2 / 255, 0xf7 / 255);
const TEXT = rgb(0x17 / 255, 0x17 / 255, 0x17 / 255);
const SUBTEXT = rgb(0x6b / 255, 0x6b / 255, 0x6b / 255);
const MUTED = rgb(0x9a / 255, 0x9a / 255, 0xa5 / 255);
const BORDER = rgb(0xe5 / 255, 0xe5 / 255, 0xe5 / 255);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

function pdfCurrencyPrefix(code) {
  if (!code || code === "INR") return "Rs. ";
  return currencySymbol(code);
}

function money(n, currency) {
  const v = Number(n) || 0;
  return `${pdfCurrencyPrefix(currency)}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SANITIZE_REPLACEMENTS = { "₹": "Rs.", "−": "-", "–": "-", "—": "-" };
const sanitizeCache = new Map();
function sanitizeForFont(font, str) {
  let out = "";
  for (const ch of str) {
    let cached = sanitizeCache.get(ch);
    if (cached === undefined) {
      try {
        font.widthOfTextAtSize(ch, 10);
        cached = ch;
      } catch {
        cached = SANITIZE_REPLACEMENTS[ch] || "?";
      }
      sanitizeCache.set(ch, cached);
    }
    out += cached;
  }
  return out;
}

export async function buildInvoicePdfBytes(model) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (need) => {
    if (y - need < MARGIN) newPage();
  };
  const text = (str, x, yy, { font = regular, size = 10, color = TEXT, align = "left", maxWidth } = {}) => {
    const raw = String(str ?? "");
    if (!raw) return;
    const s = sanitizeForFont(font, raw);
    const w = font.widthOfTextAtSize(s, size);
    let drawX = x;
    if (align === "right") drawX = x - w;
    else if (align === "center") drawX = x - w / 2;
    page.drawText(s, { x: drawX, y: yy, size, font, color, maxWidth });
  };
  const line = (x1, yy, x2, yy2, color = BORDER, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy2 }, thickness, color });
  };
  const rect = (x, yy, w, h, color) => {
    page.drawRectangle({ x, y: yy, width: w, height: h, color });
  };

  const right = PAGE_W - MARGIN;
  const { items = [], currency, discount, taxRate } = model;
  const { subtotal, discountAmt, taxAmt, total } = computeTotals(items, discount, taxRate);

  text("INVOICE", MARGIN, y - 24, { font: bold, size: 28, color: TEXT });
  text("Thank you for your business.", MARGIN, y - 40, { size: 9.5, color: MUTED });

  const metaX = right;
  let metaY = y - 6;
  const metaRow = (label, value) => {
    text(label, metaX, metaY, { font: regular, size: 8.5, color: SUBTEXT, align: "right" });
    metaY -= 12;
    text(value, metaX, metaY, { font: bold, size: 10.5, color: TEXT, align: "right" });
    metaY -= 18;
  };
  metaRow("Invoice No.", model.invoiceNumber || "—");
  metaRow("Issue Date", model.invoiceDate || "—");
  if (model.dueDate) metaRow("Due Date", model.dueDate);
  if (model.paymentTerms) metaRow("Payment Terms", model.paymentTerms);

  y = Math.min(y - 56, metaY) - 24;

  const colW = (right - MARGIN - 24) / 2;
  const drawParty = (label, party, x) => {
    let py = y;
    text(label, x, py, { font: regular, size: 9, color: SUBTEXT });
    py -= 16;
    if (isPartyBlank(party)) {
      text("—", x, py, { size: 10, color: SUBTEXT });
      return py;
    }
    const lines = [
      party.name,
      party.contact,
      party.address,
      [party.city, party.state, party.postalCode].filter(Boolean).join(", "),
      party.country,
      party.email,
      party.phone,
      party.tax ? `Tax/GST: ${party.tax}` : "",
    ].filter(Boolean);
    lines.forEach((ln, i) => {
      text(ln, x, py, { size: i === 0 ? 10.5 : 9.5, font: i === 0 ? bold : regular, color: i === 0 ? TEXT : SUBTEXT, maxWidth: colW });
      py -= 13;
    });
    return py;
  };
  const yA = drawParty("From", model.seller, MARGIN);
  const yB = drawParty("Bill To", model.billTo, MARGIN + colW + 24);
  y = Math.min(yA, yB) - 20;

  ensure(60);
  const colQty = right - 210;
  const colRate = right - 130;
  const colAmt = right;
  const colDesc = MARGIN + 22;

  const tableHeader = () => {
    rect(MARGIN, y - 20, right - MARGIN, 22, TABLE_HEAD_BG);
    text("#", MARGIN + 6, y - 14, { font: bold, size: 8.5, color: SUBTEXT });
    text("DESCRIPTION", colDesc, y - 14, { font: bold, size: 8.5, color: SUBTEXT });
    text("QTY", colQty, y - 14, { font: bold, size: 8.5, color: SUBTEXT, align: "right" });
    text("RATE", colRate, y - 14, { font: bold, size: 8.5, color: SUBTEXT, align: "right" });
    text("AMOUNT", colAmt, y - 14, { font: bold, size: 8.5, color: SUBTEXT, align: "right" });
    y -= 30;
  };
  tableHeader();

  items.forEach((item, i) => {
    ensure(30);
    const rowY = y;
    text(String(i + 1), MARGIN + 6, rowY, { size: 9.5, color: SUBTEXT });
    text(item.description || "—", colDesc, rowY, { size: 9.5, color: TEXT, maxWidth: colQty - colDesc - 10 });
    text(String(item.qty ?? 0), colQty, rowY, { size: 9.5, color: TEXT, align: "right" });
    text(money(item.rate, currency), colRate, rowY, { size: 9.5, color: TEXT, align: "right" });
    text(money((Number(item.qty) || 0) * (Number(item.rate) || 0), currency), colAmt, rowY, { size: 9.5, font: bold, color: TEXT, align: "right" });
    y -= 16;
    line(MARGIN, y, right, y, BORDER, 0.5);
    y -= 14;
    if (y < MARGIN + 40 && i < items.length - 1) {
      newPage();
      tableHeader();
    }
  });
  y -= 6;

  ensure(100);
  const panelW = 210;
  const panelX = right - panelW;
  const rowH = 18;
  const rows = [["Subtotal", money(subtotal, currency), true]];
  if (discountAmt > 0) rows.push(["Discount", `− ${money(discountAmt, currency)}`, false]);
  rows.push([`Tax (${Number(taxRate)}%)`, money(taxAmt, currency), false]);
  const panelTopPad = 10;
  const panelH = panelTopPad * 2 + rows.length * rowH + 30;

  rect(panelX, y - panelH, panelW, panelH, PANEL_BG);
  let rowY = y - panelTopPad - 10;
  rows.forEach(([label, value, emphasize]) => {
    text(label, panelX + 14, rowY, { size: 9.5, font: emphasize ? bold : regular, color: emphasize ? TEXT : SUBTEXT });
    text(value, panelX + panelW - 14, rowY, { size: 9.5, font: emphasize ? bold : regular, color: emphasize ? TEXT : SUBTEXT, align: "right" });
    rowY -= rowH;
  });
  const totalBarH = 30;
  rect(panelX, y - panelH, panelW, totalBarH, ACCENT_BG);
  text("TOTAL", panelX + 14, y - panelH + 11, { font: bold, size: 11, color: ACCENT_DARK });
  text(money(total, currency), panelX + panelW - 14, y - panelH + 11, { font: bold, size: 11, color: ACCENT_DARK, align: "right" });

  y -= panelH + 20;

  if (model.notes) {
    const notesSanitized = sanitizeForFont(regular, String(model.notes));
    const words = notesSanitized.split(/\s+/);
    const wrapped = [];
    let lineStr = "";
    words.forEach((w) => {
      const trial = lineStr ? `${lineStr} ${w}` : w;
      if (regular.widthOfTextAtSize(trial, 9.5) > right - MARGIN - 28) {
        wrapped.push(lineStr);
        lineStr = w;
      } else {
        lineStr = trial;
      }
    });
    if (lineStr) wrapped.push(lineStr);

    const boxH = 20 + wrapped.length * 13;
    ensure(boxH + 30);
    text("Notes", MARGIN, y, { font: bold, size: 10, color: TEXT });
    y -= 16;
    rect(MARGIN, y - boxH, right - MARGIN, boxH, PANEL_BG);
    let ny = y - 14;
    wrapped.forEach((ln) => {
      text(ln, MARGIN + 14, ny, { size: 9.5, color: SUBTEXT });
      ny -= 13;
    });
    y -= boxH + 20;
  }

  const pi = model.paymentInfo || {};
  const hasBank = ["bankName", "accountName", "accountNumber", "ifsc"].some((k) => String(pi[k] || "").trim());
  const hasUpi = String(pi.upiId || "").trim();
  if (hasBank || hasUpi) {
    ensure(120);
    text("Payment Information", MARGIN, y, { font: bold, size: 10, color: TEXT });
    y -= 16;

    const bankRows = [
      ["Bank Name", pi.bankName],
      ["Account Name", pi.accountName],
      ["Account Number", pi.accountNumber],
      ["IFSC Code", pi.ifsc],
    ].filter(([, v]) => String(v || "").trim());
    if (!hasUpi && pi.instructions) bankRows.push(["Instructions", pi.instructions]);

    const upiPanelW = hasUpi ? 150 : 0;
    const boxH = Math.max(bankRows.length * 15 + 24, hasUpi ? 70 : 0);
    rect(MARGIN, y - boxH, right - MARGIN, boxH, PANEL_BG);

    let by = y - 22;
    bankRows.forEach(([label, value]) => {
      text(label, MARGIN + 14, by, { size: 9, color: SUBTEXT });
      text(value, MARGIN + 150, by, { size: 9.5, color: TEXT, maxWidth: right - MARGIN - upiPanelW - 170 });
      by -= 15;
    });

    if (hasUpi) {
      const upiX = right - upiPanelW;
      line(upiX, y, upiX, y - boxH, BORDER, 1);
      text("UPI Payments", upiX + 14, y - 22, { font: bold, size: 9.5, color: TEXT });
      text("You can also pay via UPI using:", upiX + 14, y - 36, { size: 8.5, color: SUBTEXT, maxWidth: upiPanelW - 24 });
      text(pi.upiId, upiX + 14, y - 50, { size: 9.5, color: TEXT });
    }
    y -= boxH + 16;
  }

  const footerY = MARGIN - 8;
  text(`Invoice generated on ${model.invoiceDate || ""}`, MARGIN, footerY, { size: 8, color: SUBTEXT });
  if (model.seller?.email) {
    text(`For any queries, contact ${model.seller.email}`, right, footerY, { size: 8, color: SUBTEXT, align: "right" });
  }

  return doc.save();
}
