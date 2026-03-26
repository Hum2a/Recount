export function escapeIcsText(s: string) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function buildIcsCalendar(prodId: string, events: Array<{ uid: string; date: string; summary: string }>) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${escapeIcsText(prodId)}`, "CALSCALE:GREGORIAN"];
  const stamp = formatIcsUtcNow();
  for (const ev of events) {
    const endNext = addOneDay(ev.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(ev.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ev.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${endNext.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcsText(ev.summary)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function formatIcsUtcNow() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function addOneDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}
