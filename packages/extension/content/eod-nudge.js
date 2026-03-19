const ID = "recount-eod-banner";
if (document.getElementById(ID)) {
  /* already shown */
} else {
  const el = document.createElement("div");
  el.id = ID;
  el.textContent = "Recount: time for your honest end-of-day review. Open the extension.";
  Object.assign(el.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483647",
    maxWidth: "320px",
    padding: "12px 14px",
    background: "#18181b",
    color: "#fafafa",
    font: "14px system-ui, sans-serif",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  });
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 20000);
}
