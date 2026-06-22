import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type IssueReport = {
  id?: string;
  title?: string;
  customer?: string;
  location?: string;
  equipment?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  source?: string;
  dueAt?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  notes?: string;
  photoDataUrl?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("ISSUE_EMAIL_FROM") || "SiteWorks <onboarding@resend.dev>";
    const replyTo = Deno.env.get("ISSUE_EMAIL_REPLY_TO") || "";

    if (!resendApiKey) {
      return jsonResponse({ error: "RESEND_API_KEY is not configured in Supabase secrets." }, 500);
    }

    const payload = await request.json();
    const to = String(payload?.to || "").trim();
    const issue = normalizeIssue(payload?.issue || {});

    if (!isEmailAddress(to)) {
      return jsonResponse({ error: "A valid recipient email is required." }, 400);
    }

    const pdfBytes = await buildIssuePdf(issue);
    const pdfBase64 = bytesToBase64(pdfBytes);
    const filename = `siteworks-issue-${safeFilename(issue.id || "report")}.pdf`;

    const resendPayload: Record<string, unknown> = {
      from: fromEmail,
      to: [to],
      subject: `SiteWorks Issue: ${issue.priority} - ${issue.equipment}`,
      html: buildEmailHtml(issue),
      text: buildEmailText(issue),
      attachments: [
        {
          filename,
          content: pdfBase64,
          content_type: "application/pdf"
        }
      ]
    };

    if (replyTo) resendPayload.reply_to = replyTo;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resendPayload)
    });

    const resendResult = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      return jsonResponse({
        error: resendResult?.message || "Resend could not send the email.",
        details: resendResult
      }, resendResponse.status);
    }

    return jsonResponse({ ok: true, id: resendResult?.id || "" });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected email error." }, 500);
  }
});

function normalizeIssue(input: IssueReport): Required<IssueReport> {
  return {
    id: String(input.id || "not-recorded"),
    title: String(input.title || "Open issue"),
    customer: String(input.customer || "Unknown customer"),
    location: String(input.location || "Unknown location"),
    equipment: String(input.equipment || "Area report"),
    status: String(input.status || "Open"),
    priority: String(input.priority || "Medium"),
    assignedTo: String(input.assignedTo || "Unassigned"),
    source: String(input.source || "SiteWorks"),
    dueAt: String(input.dueAt || "Not set"),
    createdAt: String(input.createdAt || "Not recorded"),
    updatedAt: String(input.updatedAt || "Not recorded"),
    resolvedAt: String(input.resolvedAt || ""),
    notes: String(input.notes || "No notes provided."),
    photoDataUrl: String(input.photoDataUrl || "")
  };
}

async function buildIssuePdf(issue: Required<IssueReport>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.03, 0.44, 0.37);
  const text = rgb(0.09, 0.13, 0.15);
  const muted = rgb(0.38, 0.44, 0.47);
  const line = rgb(0.82, 0.87, 0.85);
  const light = rgb(0.94, 0.97, 0.95);

  let y = 746;
  page.drawRectangle({ x: 36, y: 34, width: 540, height: 724, borderColor: line, borderWidth: 1 });
  page.drawText("SITEWORKS", { x: 58, y, size: 11, font: bold, color: green });
  y -= 30;
  page.drawText("Issue Report", { x: 58, y, size: 28, font: bold, color: text });
  page.drawText("Generated", { x: 450, y: 748, size: 8, font: bold, color: muted });
  page.drawText(new Date().toLocaleString(), { x: 450, y: 735, size: 9, font, color: text });
  page.drawText("Issue ID", { x: 450, y: 710, size: 8, font: bold, color: muted });
  page.drawText(truncate(issue.id, 24), { x: 450, y: 697, size: 9, font, color: text });
  page.drawLine({ start: { x: 58, y: 686 }, end: { x: 554, y: 686 }, thickness: 2, color: green });

  y = 658;
  page.drawText(wrapLine(issue.title, 58), { x: 58, y, size: 16, font: bold, color: text });
  y -= 30;
  page.drawRectangle({ x: 58, y, width: 230, height: 24, color: light, borderColor: line, borderWidth: 1 });
  page.drawText(`${issue.status} | ${issue.priority} Priority`, { x: 68, y: y + 8, size: 10, font: bold, color: green });
  y -= 22;

  const rows = [
    ["Customer", issue.customer],
    ["Location", issue.location],
    ["Equipment / Area", issue.equipment],
    ["Assigned to", issue.assignedTo],
    ["Source", issue.source],
    ["Due", issue.dueAt],
    ["Created", issue.createdAt],
    ["Last updated", issue.updatedAt],
    ...(issue.resolvedAt ? [["Resolved", issue.resolvedAt]] : []),
    ["Issue ID", issue.id]
  ];

  y -= 12;
  rows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = col === 0 ? 58 : 314;
    const boxY = y - row * 54;
    page.drawRectangle({ x, y: boxY - 34, width: 240, height: 44, borderColor: line, borderWidth: 1 });
    page.drawText(label, { x: x + 10, y: boxY - 4, size: 7, font: bold, color: muted });
    page.drawText(truncate(String(value), 38), { x: x + 10, y: boxY - 22, size: 10, font, color: text });
  });

  y -= Math.ceil(rows.length / 2) * 54 + 8;
  page.drawText("Issue Notes", { x: 58, y, size: 9, font: bold, color: muted });
  y -= 16;
  page.drawRectangle({ x: 58, y: y - 124, width: 496, height: 132, borderColor: line, borderWidth: 1 });
  const noteLines = wrapText(issue.notes, 82).slice(0, 9);
  noteLines.forEach((lineText, index) => {
    page.drawText(lineText, { x: 70, y: y - 18 - index * 13, size: 9, font, color: text });
  });

  y -= 156;
  if (issue.photoDataUrl) {
    const image = await tryEmbedImage(pdfDoc, issue.photoDataUrl);
    if (image) {
      page.drawText("Submitted Photo", { x: 58, y, size: 9, font: bold, color: muted });
      const fit = image.scaleToFit(220, 120);
      page.drawImage(image, { x: 58, y: y - fit.height - 10, width: fit.width, height: fit.height });
    }
  }

  page.drawText("Technician / Reviewer", { x: 58, y: 116, size: 8, font: bold, color: muted });
  page.drawLine({ start: { x: 58, y: 92 }, end: { x: 270, y: 92 }, thickness: 1, color: muted });
  page.drawText("Date Completed", { x: 330, y: 116, size: 8, font: bold, color: muted });
  page.drawLine({ start: { x: 330, y: 92 }, end: { x: 554, y: 92 }, thickness: 1, color: muted });
  page.drawText("Preventative Maintenance Issue Form", { x: 58, y: 58, size: 8, font, color: muted });
  page.drawText("SiteWorks", { x: 512, y: 58, size: 8, font: bold, color: green });

  return pdfDoc.save();
}

async function tryEmbedImage(pdfDoc: PDFDocument, dataUrl: string) {
  try {
    const match = dataUrl.match(/^data:(image\/png|image\/jpe?g);base64,(.+)$/i);
    if (!match) return null;
    const bytes = base64ToBytes(match[2]);
    return match[1].toLowerCase().includes("png")
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function buildEmailHtml(issue: Required<IssueReport>): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#172126;line-height:1.45">
      <p style="color:#08705f;font-weight:800;text-transform:uppercase;letter-spacing:.05em">SiteWorks Issue Report</p>
      <h1 style="margin:0 0 12px">${escapeHtml(issue.title)}</h1>
      <p><strong>Status:</strong> ${escapeHtml(issue.status)} | <strong>Priority:</strong> ${escapeHtml(issue.priority)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(issue.customer)}<br>
      <strong>Location:</strong> ${escapeHtml(issue.location)}<br>
      <strong>Equipment / Area:</strong> ${escapeHtml(issue.equipment)}<br>
      <strong>Assigned to:</strong> ${escapeHtml(issue.assignedTo)}</p>
      <p><strong>Notes:</strong><br>${escapeHtml(issue.notes).replace(/\n/g, "<br>")}</p>
      <p>The professional PDF issue form is attached.</p>
    </div>
  `;
}

function buildEmailText(issue: Required<IssueReport>): string {
  return [
    "SiteWorks Issue Report",
    "",
    `Issue: ${issue.title}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority}`,
    `Customer: ${issue.customer}`,
    `Location: ${issue.location}`,
    `Equipment / Area: ${issue.equipment}`,
    `Assigned to: ${issue.assignedTo}`,
    `Due: ${issue.dueAt}`,
    `Created: ${issue.createdAt}`,
    `Issue ID: ${issue.id}`,
    "",
    "Notes:",
    issue.notes,
    "",
    "The professional PDF issue form is attached."
  ].join("\n");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function wrapText(value: string, maxLength: number): string[] {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function wrapLine(value: string, maxLength: number): string {
  return truncate(String(value || ""), maxLength);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function safeFilename(value: string): string {
  return String(value || "report").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
