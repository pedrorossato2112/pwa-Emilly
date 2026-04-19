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

// FIREBASE
const db = window.db;

function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString("pt-BR");
}

// ==================== FIREBASE ====================

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

function firebaseAdd(col, data) {
  return addDoc(collection(db, col), data);
}

function firebaseListen(col, callback) {
  const q = query(collection(db, col), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const docs = [];
    snapshot.forEach((doc) => docs.push(doc.data()));
    callback(docs);
  });
}

// ==================== COMPRESSÃO DE IMAGEM ====================

function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        const scale = maxWidth / width;
        width = maxWidth;
        height = height * scale;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== FOTOS ====================

const photoInput = $("#photoInput");
const photoGrid = $("#photoGrid");
const emptyPhotos = $("#emptyPhotos");

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files || []);
  if (!files.length) return;

  for (const file of files) {
    const base64 = await compressImage(file);

    await firebaseAdd("fotos", {
      url: base64,
      createdAt: Date.now()
    });
  }

  photoInput.value = "";
});

function renderPhotosRealtime() {
  firebaseListen("fotos", (docs) => {
    photoGrid.innerHTML = "";

    if (!docs.length) {
      emptyPhotos.style.display = "block";
      return;
    }

    emptyPhotos.style.display = "none";

    docs.forEach((p) => {
      const card = document.createElement("div");
      card.className = "photo";
      card.innerHTML = `
        <img src="${p.url}" />
        <div class="meta">
          <div class="pill">${fmtDate(p.createdAt)}</div>
        </div>
      `;
      photoGrid.appendChild(card);
    });
  });
}

// ==================== CARTAS ====================

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

  await firebaseAdd("cartas", {
    to,
    title,
    body,
    createdAt: Date.now()
  });

  letterTo.value = "";
  letterTitle.value = "";
  letterBody.value = "";
});

function renderLettersRealtime() {
  firebaseListen("cartas", (docs) => {
    letterList.innerHTML = "";

    if (!docs.length) {
      emptyLetters.style.display = "block";
      return;
    }

    emptyLetters.style.display = "none";

    docs.forEach((l) => {
      const el = document.createElement("div");
      el.className = "letter";
      el.innerHTML = `
        <div class="toprow">
          <div>
            <div class="t">${l.title}</div>
            <div class="s">${l.to ? "Para: " + l.to + " • " : ""}${fmtDate(l.createdAt)}</div>
          </div>
        </div>
        <div class="b">${l.body}</div>
      `;
      letterList.appendChild(el);
    });
  });
}

// ==================== INIT ====================

renderPhotosRealtime();
renderLettersRealtime();