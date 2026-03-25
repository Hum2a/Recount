const ID = "recount-intent-banner";
if (document.getElementById(ID)) {
  /* already shown */
} else {
  const el = document.createElement("div");
  el.id = ID;
  el.textContent =
    "Recount: you set intentions today — this site is on your distraction list. Refocus when you are ready.";
  Object.assign(el.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    maxWidth: "360px",
    padding: "12px 14px",
    background: "#1e3a5f",
    color: "#f8fafc",
    font: "14px system-ui, sans-serif",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  });
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 14000);
}
