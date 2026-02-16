const $ = (s) => document.querySelector(s);

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = {
  album: $("#panel-album"),
  cartas: $("#panel-cartas"),
  backup: $("#panel-backup")
};

tabs.forEach((b) => {
  b.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[b.dataset.tab].classList.add("active");
  });
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");

const DB_NAME = "album_emilly";
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
      if (!db.objectStoreNames.contains("letters")) db.createObjectStore("letters", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(16).slice(2));
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function addPhotoFromFile(file) {
  const dataUrl = await fileToDataURL(file);
  const db = await openDB();
  const item = { id: id(), dataUrl, createdAt: Date.now() };
  await new Promise((res, rej) => {
    const r = tx(db, "photos", "readwrite").add(item);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  db.close();
}

async function getAll(store) {
  const db = await openDB();
  const items = await new Promise((res, rej) => {
    const r = tx(db, store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return items;
}

async function del(store, key) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const r = tx(db, store, "readwrite").delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  db.close();
}

function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const photoInput = $("#photoInput");
const photoGrid = $("#photoGrid");
const emptyPhotos = $("#emptyPhotos");

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files || []);
  if (!files.length) return;
  for (const f of files) await addPhotoFromFile(f);
  photoInput.value = "";
  await renderPhotos();
});

async function renderPhotos() {
  const photos = (await getAll("photos")).sort((a, b) => b.createdAt - a.createdAt);
  photoGrid.innerHTML = "";
  emptyPhotos.style.display = photos.length ? "none" : "block";

  for (const p of photos) {
    const card = document.createElement("div");
    card.className = "photo";
    card.innerHTML = `
      <img src="${p.dataUrl}" alt="foto" />
      <div class="meta">
        <div class="pill">${fmtDate(p.createdAt)}</div>
        <button class="iconBtn" data-del="${p.id}">Remover</button>
      </div>
    `;
    photoGrid.appendChild(card);
  }

  photoGrid.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await del("photos", btn.getAttribute("data-del"));
      await renderPhotos();
    });
  });
}

const letterTo = $("#letterTo");
const letterTitle = $("#letterTitle");
const letterBody = $("#letterBody");
const addLetterBtn = $("#addLetterBtn");
const letterList = $("#letterList");
const emptyLetters = $("#emptyLetters");

addLetterBtn.addEventListener("click", async () => {
  const to = letterTo.value.trim();
  const title = letterTitle.value.trim();
  const body = letterBody.value.trim();
  if (!title || !body) return;

  const db = await openDB();
  const item = { id: id(), to, title, body, createdAt: Date.now() };
  await new Promise((res, rej) => {
    const r = tx(db, "letters", "readwrite").add(item);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  db.close();

  letterTo.value = "";
  letterTitle.value = "";
  letterBody.value = "";
  await renderLetters();
});

async function renderLetters() {
  const letters = (await getAll("letters")).sort((a, b) => b.createdAt - a.createdAt);
  letterList.innerHTML = "";
  emptyLetters.style.display = letters.length ? "none" : "block";

  for (const l of letters) {
    const el = document.createElement("div");
    el.className = "letter";
    el.innerHTML = `
      <div class="toprow">
        <div>
          <div class="t">${escapeHtml(l.title)}</div>
          <div class="s">${(l.to ? "Para: " + escapeHtml(l.to) + " • " : "")}${fmtDate(l.createdAt)}</div>
        </div>
        <button class="iconBtn" data-del-letter="${l.id}">Remover</button>
      </div>
      <div class="b">${escapeHtml(l.body)}</div>
    `;
    letterList.appendChild(el);
  }

  letterList.querySelectorAll("[data-del-letter]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await del("letters", btn.getAttribute("data-del-letter"));
      await renderLetters();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const exportBtn = $("#exportBtn");
const importInput = $("#importInput");
const wipeBtn = $("#wipeBtn");
const backupNote = $("#backupNote");

exportBtn.addEventListener("click", async () => {
  const photos = await getAll("photos");
  const letters = await getAll("letters");
  const payload = { v: 1, createdAt: Date.now(), photos, letters };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup-nosso-album.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  backupNote.textContent = "Backup exportado. Envie o arquivo pra outra pessoa e importe lá.";
});

importInput.addEventListener("change", async () => {
  const f = (importInput.files || [])[0];
  if (!f) return;
  const text = await f.text();
  let data;
  try { data = JSON.parse(text); } catch { backupNote.textContent = "Arquivo inválido."; importInput.value = ""; return; }
  if (!data || !Array.isArray(data.photos) || !Array.isArray(data.letters)) { backupNote.textContent = "Backup inválido."; importInput.value = ""; return; }

  const db = await openDB();
  await new Promise((res, rej) => {
    const t = db.transaction(["photos", "letters"], "readwrite");
    const sp = t.objectStore("photos");
    const sl = t.objectStore("letters");
    for (const p of data.photos) sp.put(p);
    for (const l of data.letters) sl.put(l);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  db.close();

  importInput.value = "";
  backupNote.textContent = "Backup importado com sucesso.";
  await renderPhotos();
  await renderLetters();
});

wipeBtn.addEventListener("click", async () => {
  const ok = confirm("Tem certeza que quer apagar TUDO (fotos e cartinhas) deste aparelho?");
  if (!ok) return;
  const db = await openDB();
  await new Promise((res, rej) => {
    const t = db.transaction(["photos", "letters"], "readwrite");
    t.objectStore("photos").clear();
    t.objectStore("letters").clear();
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  db.close();
  backupNote.textContent = "Tudo apagado neste aparelho.";
  await renderPhotos();
  await renderLetters();
});

renderPhotos();
renderLetters();
