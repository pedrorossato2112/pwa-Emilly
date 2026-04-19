import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxlNiBEj9V0lU-EyiNRwPiK2B9tWee6Bg",
  authDomain: "nosso-mundo-6eb7a.firebaseapp.com",
  projectId: "nosso-mundo-6eb7a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);

// TABS
const tabs = document.querySelectorAll(".tab");
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

// DATA
function fmtDate(ms) {
  return new Date(ms).toLocaleDateString("pt-BR");
}

// COMPRESSÃO
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => img.src = e.target.result;

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let w = img.width;
      let h = img.height;

      if (w > maxWidth) {
        const scale = maxWidth / w;
        w = maxWidth;
        h *= scale;
      }

      canvas.width = w;
      canvas.height = h;

      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    reader.readAsDataURL(file);
  });
}

// FOTOS
const photoInput = $("#photoInput");
const photoGrid = $("#photoGrid");
const emptyPhotos = $("#emptyPhotos");

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files || []);

  for (const file of files) {
    const base64 = await compressImage(file);

    await addDoc(collection(db, "fotos"), {
      url: base64,
      createdAt: Date.now()
    });
  }
});

onSnapshot(query(collection(db, "fotos"), orderBy("createdAt", "desc")), (snap) => {
  photoGrid.innerHTML = "";

  if (snap.empty) {
    emptyPhotos.style.display = "block";
    return;
  }

  emptyPhotos.style.display = "none";

  snap.forEach(doc => {
    const p = doc.data();

    const el = document.createElement("div");
    el.className = "photo";
    el.innerHTML = `
      <img src="${p.url}">
      <div class="meta">
        <div class="pill">${fmtDate(p.createdAt)}</div>
      </div>
    `;

    photoGrid.appendChild(el);
  });
});

// CARTAS
const letterTo = $("#letterTo");
const letterTitle = $("#letterTitle");
const letterBody = $("#letterBody");
const addLetterBtn = $("#addLetterBtn");
const letterList = $("#letterList");

addLetterBtn.addEventListener("click", async () => {
  if (!letterTitle.value || !letterBody.value) return;

  await addDoc(collection(db, "cartas"), {
    to: letterTo.value,
    title: letterTitle.value,
    body: letterBody.value,
    createdAt: Date.now()
  });

  letterTo.value = "";
  letterTitle.value = "";
  letterBody.value = "";
});

onSnapshot(query(collection(db, "cartas"), orderBy("createdAt", "desc")), (snap) => {
  letterList.innerHTML = "";

  snap.forEach(doc => {
    const l = doc.data();

    const el = document.createElement("div");
    el.className = "letter";
    el.innerHTML = `
      <div class="t">${l.title}</div>
      <div class="s">${l.to || ""} • ${fmtDate(l.createdAt)}</div>
      <div class="b">${l.body}</div>
    `;

    letterList.appendChild(el);
  });
});