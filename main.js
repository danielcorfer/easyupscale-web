import * as ort from "./vendor/ort/ort.webgpu.min.mjs"; // self-hosted (prepare.py), the page makes no request to a third party

import { OUT_SCALE, PRICE, LINKS, WATERMARK_TEXT, POLAR_API, POLAR_ORG_ID, LICENCE_GRACE_DAYS, SINGLE_KEY_PREFIX, PRICE_CLEAN } from "./config.js";

ort.env.wasm.wasmPaths = new URL("vendor/ort/", import.meta.url).href;

const TILE = 256, OVERLAP = 24, CORE = TILE - 2 * OVERLAP, SCALE = 4; // the exported networks have a fixed 256 px input and make 4x, like the native app
const asset = (path) => new URL(path, import.meta.url).href; // pages in subfolders (designs/) load from the same root
const K = OUT_SCALE / SCALE; // result pixels per network pixel
const $ = (id) => document.getElementById(id);
let strings = {}, image = null, sessionKey = "", session = null, busy = false, hasWebGpu = false, hasF16 = false;

let fallback = {};
const LANG = document.documentElement.lang || "cs";
const t = (key, vars = {}) => (strings[key] ?? fallback[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
const price = () => strings.price ?? PRICE; // formatted per language
const cleanPrice = () => strings["price.clean"] ?? PRICE_CLEAN;
const vars = () => ({ price: price(), cleanPrice: cleanPrice() });

async function loadStrings() {
  strings = await (await fetch(asset(`strings/${LANG}.json`))).json();
  if (LANG !== "en") fallback = await (await fetch(asset("strings/en.json"))).json().catch(() => ({})); // a missing key falls back to English
  document.title = t("title");
  document.dispatchEvent(new CustomEvent("strings-ready", { detail: strings }));
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n, vars());
  for (const el of document.querySelectorAll("[data-label-i18n]")) el.dataset.label = t(el.dataset.labelI18n);
  for (const el of document.querySelectorAll("[data-score]")) el.textContent = t("plan.score", { n: el.dataset.score, total: el.dataset.total });
  fillPromo();
}

function fillPromo() {
  for (const a of document.querySelectorAll("[data-link]")) { if (!a.getAttribute("href") && !LINKS[a.dataset.link]) { a.hidden = true; continue; } if (!a.getAttribute("href")) a.href = LINKS[a.dataset.link]; if (a.dataset.link === "download" || a.dataset.link === "buy") { a.target = "_blank"; a.rel = "noopener"; } }
  const put = (id, text) => { if ($(id)) $(id).textContent = text; };
  put("appLead", t("app.lead", { price: price() })); put("buyTitle", t("buy.title", { price: price() })); put("heroFacts", t("v8.facts", { price: price() }));
  for (const id of ["buyTop", "buyBottom", "buyHero", "buyVs", "buyVs2", "buyUnlock"]) put(id, t("cta.buy", { price: price() }));
  put("buyClean", t("cta.clean", vars()));
  const rows = ["scale", "models", "auto", "batch", "formats", "speed", "privacy", "large"];
  $("cmpBody")?.replaceChildren(...rows.map((row) => {
    const tr = document.createElement("tr");
    for (const [key, header] of [["cmp." + row, "cmp.feature"], ["cmp." + row + ".web", "cmp.web"], ["cmp." + row + ".app", "cmp.app"]]) {
      const cell = document.createElement(key === "cmp." + row ? "th" : "td"); cell.textContent = t(key); cell.dataset.label = t(header); tr.append(cell);
    }
    return tr;
  }));
}

function setStatus(text, error = false) { $("statusText").textContent = text; $("statusText").classList.toggle("err", error); }
function chip(text, cls = "") { const s = document.createElement("span"); s.className = "chip " + cls; s.textContent = text; $("chips").append(s); }

async function detectDevice() {
  try {
    const adapter = "gpu" in navigator ? await navigator.gpu.requestAdapter() : null;
    hasWebGpu = !!adapter; hasF16 = !!adapter?.features.has("shader-f16");
  } catch { hasWebGpu = false; }
  if (hasWebGpu) { chip(t("env.gpu"), "ok"); if (hasF16) chip(t("env.f16")); } else chip(t("env.nogpu"), "warn");
  if (!hasWebGpu) $("backend").value = "wasm";
  if (!hasF16) $("precision").value = "fp32";
}

async function getSession() {
  const model = document.querySelector("input[name=model]:checked").value, backend = $("backend").value;
  const fp16 = $("precision").value === "fp16" && backend === "webgpu" && hasF16;
  const key = `${model}/${backend}/${fp16}`;
  if (key === sessionKey) return session;
  session = null;
  setStatus(t("status.loadingModel"));
  const response = await fetch(asset(`models/${model}${fp16 ? "_fp16" : ""}.onnx`));
  session = await ort.InferenceSession.create(new Uint8Array(await response.arrayBuffer()), { executionProviders: [backend], graphOptimizationLevel: "all" });
  sessionKey = key;
  return session;
}

function reflect(i, n) { // mirror an index into 0..n-1 (edge-clamped when the image is tiny)
  if (n === 1) return 0;
  const period = 2 * (n - 1);
  i = ((i % period) + period) % period;
  return i < n ? i : period - i;
}

function readTile(data, w, h, x0, y0) { // x0,y0 in padded coordinates (padding = OVERLAP on top/left)
  const out = new Float32Array(3 * TILE * TILE), plane = TILE * TILE;
  for (let y = 0; y < TILE; y++) {
    const sy = reflect(y0 + y - OVERLAP, h);
    for (let x = 0; x < TILE; x++) {
      const si = (sy * w + reflect(x0 + x - OVERLAP, w)) * 4, di = y * TILE + x;
      out[di] = data[si] / 255; out[plane + di] = data[si + 1] / 255; out[2 * plane + di] = data[si + 2] / 255;
    }
  }
  return out;
}

async function runTile(sess, input) {
  const result = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, TILE, TILE]) });
  return result[sess.outputNames[0]].getData();
}

let watermarkPatch = null;
async function drawWatermark(ctx, width, height) { // discreet diagonal text rows over the whole result; drawn into the result so preview and download match
  try { await document.fonts.load("700 20px Outfit"); } catch { /* fall back to the system font */ }
  const copy = document.createElement("canvas"); copy.width = width; copy.height = height; copy.getContext("2d").drawImage(ctx.canvas, 0, 0);
  watermarkPatch = { canvas: copy }; // the clean result, kept so a licence key can take the mark off
  const size = Math.max(16, Math.round(Math.min(width, height) * 0.032)), stepY = size * 4.2, label = WATERMARK_TEXT + "      ";
  ctx.save();
  ctx.font = `700 ${size}px Outfit, "Segoe UI", sans-serif`; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.12; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.fillStyle = "rgba(255,255,255,0.5)";
  const stepX = ctx.measureText(label).width, reach = Math.hypot(width, height);
  ctx.translate(width / 2, height / 2); ctx.rotate(-Math.PI / 6);
  for (let row = 0, y = -reach / 2; y < reach / 2; row++, y += stepY) {
    for (let x = -reach / 2 - (row % 2) * stepX / 2; x < reach / 2; x += stepX) { ctx.strokeText(label, x, y); ctx.fillText(label, x, y); }
  }
  ctx.restore();
}

// ---- image in / out ----
async function loadImage(source) {
  image = await createImageBitmap(source);
  const src = $("src"); src.width = image.width * OUT_SCALE; src.height = image.height * OUT_SCALE; // the original is shown at result size so the slider lines up
  const ctx = src.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(image, 0, 0, src.width, src.height);
  const dst = $("dst"); dst.width = src.width; dst.height = src.height;
  dst.getContext("2d").drawImage(src, 0, 0); // until the result is ready the right half shows the plain enlargement
  document.body.classList.add("has-image"); document.body.classList.remove("has-result");
  $("work").hidden = false; $("save").hidden = true; $("unlock").hidden = true; watermarkPatch = null; $("upsell").hidden = true; $("run").disabled = false;
  setSlider(50);
  setStatus(t("status.imageInfo", { w: image.width, h: image.height }));
}

function setSlider(percent) {
  percent = Math.min(100, Math.max(0, percent));
  $("beforeclip").style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  $("handle").style.left = percent + "%"; $("handle").setAttribute("aria-valuenow", Math.round(percent));
}
(() => {
  const box = $("compare"); let dragging = false;
  const move = (event) => { const r = box.getBoundingClientRect(); setSlider(((event.clientX - r.left) / r.width) * 100); };
  box.addEventListener("pointerdown", (e) => { dragging = true; box.setPointerCapture(e.pointerId); move(e); });
  box.addEventListener("pointermove", (e) => dragging && move(e));
  box.addEventListener("pointerup", () => (dragging = false));
  $("handle").addEventListener("keydown", (e) => {
    const now = Number($("handle").getAttribute("aria-valuenow"));
    if (e.key === "ArrowLeft") setSlider(now - 5); else if (e.key === "ArrowRight") setSlider(now + 5);
  });
})();

const pick = () => $("file").click();
$("drop").addEventListener("click", (e) => { if (e.target.id !== "sample") pick(); });
$("drop").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
$("another").addEventListener("click", pick);
$("file").addEventListener("change", (e) => e.target.files[0] && !busy && loadImage(e.target.files[0]));
$("sample").addEventListener("click", async () => loadImage(await (await fetch(asset("sample.png"))).blob()));
addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("over"); });
addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("drop").classList.remove("over"); });
addEventListener("drop", (e) => { e.preventDefault(); $("drop").classList.remove("over"); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/") && !busy) loadImage(f); });
addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (f && !busy) loadImage(f); });
window.loadImage = loadImage; // for automated checks

// ---- benchmark + run ----
$("bench").addEventListener("click", async () => {
  try {
    const sess = await getSession(), input = new Float32Array(3 * TILE * TILE).fill(0.5);
    await runTile(sess, input);
    const times = [];
    for (let i = 0; i < 5; i++) { const s = performance.now(); await runTile(sess, input); times.push(performance.now() - s); }
    setStatus(t("status.bench", { ms: Math.round(times.reduce((a, b) => a + b) / times.length) }));
  } catch (e) { setStatus(t("status.error", { message: e }), true); }
});

$("run").addEventListener("click", async () => {
  if (!image || busy) return;
  busy = true; $("run").disabled = true; $("another").disabled = true; $("save").hidden = true; $("meter").hidden = false; $("bar").style.width = "0%";
  $("run").textContent = t("running");
  try {
    const sess = await getSession();
    const w = image.width, h = image.height;
    const sc = document.createElement("canvas"); sc.width = w; sc.height = h;
    const sctx = sc.getContext("2d", { willReadFrequently: true }); sctx.drawImage(image, 0, 0);
    const data = sctx.getImageData(0, 0, w, h).data;
    const dctx = $("dst").getContext("2d"), tileCanvas = document.createElement("canvas");
    dctx.imageSmoothingQuality = "high";
    const tx = Math.ceil(w / CORE), ty = Math.ceil(h / CORE), total = tx * ty;
    const t0 = performance.now(); let done = 0;
    setSlider(0); // watch the result appear over the plain enlargement
    for (let j = 0; j < ty; j++) for (let i = 0; i < tx; i++) {
      const out = await runTile(sess, readTile(data, w, h, i * CORE, j * CORE));
      const keep = CORE * SCALE, ox = i * CORE * SCALE, oy = j * CORE * SCALE;
      const cw = Math.min(keep, w * SCALE - ox), ch = Math.min(keep, h * SCALE - oy);
      const img = new ImageData(cw, ch), full = TILE * SCALE, plane = full * full, off = OVERLAP * SCALE;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const si = (y + off) * full + (x + off), di = (y * cw + x) * 4;
        img.data[di] = Math.min(255, Math.max(0, out[si] * 255 + 0.5));
        img.data[di + 1] = Math.min(255, Math.max(0, out[plane + si] * 255 + 0.5));
        img.data[di + 2] = Math.min(255, Math.max(0, out[2 * plane + si] * 255 + 0.5));
        img.data[di + 3] = 255;
      }
      if (K === 1) dctx.putImageData(img, ox, oy);
      else { // scaled down to the output size (high-quality smoothing)
        tileCanvas.width = cw; tileCanvas.height = ch; tileCanvas.getContext("2d").putImageData(img, 0, 0);
        const x0 = Math.floor(ox * K), y0 = Math.floor(oy * K);
        dctx.drawImage(tileCanvas, 0, 0, cw, ch, x0, y0, Math.ceil((ox + cw) * K) - x0, Math.ceil((oy + ch) * K) - y0);
      }
      done++;
      const elapsed = (performance.now() - t0) / 1000, eta = Math.ceil((elapsed / done) * (total - done));
      $("bar").style.width = (done / total) * 100 + "%";
      setStatus(t("status.tile", { done, total }) + (done < total ? " · " + t("status.eta", { seconds: eta }) : ""));
      await new Promise((r) => setTimeout(r)); // let the page repaint
    }
    watermarkPatch = null;
    if (!licensed) await drawWatermark(dctx, w * OUT_SCALE, h * OUT_SCALE);
    setSlider(50);
    setStatus(t("status.done", { seconds: ((performance.now() - t0) / 1000).toFixed(1) }) + " · " + t("status.size", { from: `${w}×${h}`, to: `${w * OUT_SCALE}×${h * OUT_SCALE}` }));
    $("upsell").hidden = false; document.body.classList.add("has-result");
    $("unlock").hidden = licensed;
    refreshDownload();
  } catch (e) { setStatus(t("status.error", { message: e }), true); }
  busy = false; $("run").disabled = false; $("another").disabled = false; $("run").textContent = t("run"); $("meter").hidden = true;
});

// ---- clean result: a licence key removes the watermark. Everything stays in the browser (no server of ours renders anything):
// the key is checked directly with Polar, the payment provider, through the same public endpoint the app uses. ----
let licensed = false, savedUrl = null;
const STORE_KEY = "eu-licence";
const readSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "null"); } catch { return null; } };
const writeSaved = (value) => { try { value ? localStorage.setItem(STORE_KEY, JSON.stringify(value)) : localStorage.removeItem(STORE_KEY); } catch { /* storage may be blocked */ } };

async function checkKey(key, single = false) { // "ok" | "invalid" | "used" | "network"; a single-use key is spent by this call
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const body = { key, organization_id: POLAR_ORG_ID, ...(single ? { increment_usage: 1 } : {}) };
    const response = await fetch(POLAR_API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    if (response.status >= 500 || response.status === 429) return "network";
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return single && /usage|limit/i.test(JSON.stringify(data)) ? "used" : "invalid";
    if (data.status !== "granted") return "invalid"; // refunded or disabled keys come back as revoked/disabled
    if (single && data.limit_usage != null && data.usage > data.limit_usage) return "used";
    return "ok";
  } catch { return "network"; } finally { clearTimeout(timer); }
}

function refreshDownload() {
  $("dst").toBlob((blob) => {
    if (!blob) return;
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    savedUrl = URL.createObjectURL(blob); $("save").href = savedUrl; $("save").hidden = false;
  });
}

function setLicensed(on) {
  licensed = on;
  document.body.classList.toggle("is-licensed", on);
  if (on) $("unlock").hidden = true;
}

function removeBadge() { // take the watermark off the result on screen (the clean result was kept)
  if (!watermarkPatch) return;
  $("dst").getContext("2d").drawImage(watermarkPatch.canvas, 0, 0);
  watermarkPatch = null; refreshDownload();
}
async function applyLicence() { setLicensed(true); removeBadge(); }
async function applySingle() { $("unlock").hidden = true; removeBadge(); } // only this result is clean, the next one gets the badge again

(() => {
  const dialog = $("unlockDialog"), message = $("unlockMsg"), input = $("licenceKey"), submit = $("unlockSubmit");
  const say = (text, kind = "") => { message.textContent = text; message.className = "unlockmsg " + kind; };
  $("unlock").addEventListener("click", () => { say(""); dialog.showModal(); input.focus(); });
  $("unlockClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // a click on the backdrop
  $("unlockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) return say(t("unlock.invalid"), "err");
    submit.disabled = true; say(t("unlock.checking"));
    const single = key.startsWith(SINGLE_KEY_PREFIX);
    const answer = await checkKey(key, single);
    submit.disabled = false;
    if (answer === "ok" && single) { await applySingle(); say(t("unlock.ok.single"), "ok"); setStatus(t("unlock.ok.single")); setTimeout(() => dialog.close(), 900); }
    else if (answer === "ok") { writeSaved({ key, at: Date.now() }); await applyLicence(); say(t("unlock.ok"), "ok"); setStatus(t("unlock.licensed")); setTimeout(() => dialog.close(), 900); }
    else say(t({ network: "unlock.error", used: "unlock.used" }[answer] ?? "unlock.invalid"), "err");
  });
  const saved = readSaved(); // a key that was verified within the grace period keeps the page unlocked, and is verified again in the background
  if (saved?.key) {
    if (Date.now() - saved.at < LICENCE_GRACE_DAYS * 86400000) setLicensed(true);
    checkKey(saved.key).then((answer) => {
      if (answer === "ok") { writeSaved({ key: saved.key, at: Date.now() }); setLicensed(true); }
      else if (answer === "invalid") { writeSaved(null); setLicensed(false); }
    });
  }
})();

await loadStrings();
await detectDevice();
