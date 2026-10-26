// Small page behaviour shared by all designs: manual theme, scroll reveal, header shadow, cursor spotlight.
document.documentElement.classList.add("js");

const root = document.documentElement;
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

if (root.hasAttribute("data-themeable")) {
  let saved = null;
  try { saved = localStorage.getItem("eu-theme"); } catch { /* storage may be blocked */ }
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  const button = document.createElement("button");
  button.className = "theme"; button.type = "button"; button.innerHTML = SUN;
  const label = () => (button.title = button.ariaLabel = (window.__theme_label ?? "Theme"));
  label();
  button.addEventListener("click", () => {
    const dark = (root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("eu-theme", root.dataset.theme); } catch { /* ignore */ }
  });
  document.querySelector(".nav")?.append(button);
  document.addEventListener("strings-ready", (e) => { window.__theme_label = e.detail["theme.toggle"]; label(); });
}

const header = document.querySelector(".top");
if (header) { const onScroll = () => header.classList.toggle("scrolled", scrollY > 8); addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

const reveal = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 });
  reveal.forEach((el, i) => { el.style.setProperty("--d", (i % 4) * 0.07 + "s"); io.observe(el); });
} else reveal.forEach((el) => el.classList.add("in"));

addEventListener("pointermove", (e) => { root.style.setProperty("--mx", e.clientX + "px"); root.style.setProperty("--my", e.clientY + "px"); }, { passive: true });

const langMenu = document.querySelector(".langs");
if (langMenu) {
  document.addEventListener("click", (e) => { if (!langMenu.contains(e.target)) langMenu.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") langMenu.open = false; });
}
