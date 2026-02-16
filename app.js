const msgs = [
  "Eu te amo ❤️",
  "Você é minha pessoa favorita.",
  "Você deixa meu dia melhor.",
  "Hoje é um bom dia pra sorrir 🙂"
];

document.getElementById("btn").addEventListener("click", () => {
  const i = Math.floor(Math.random() * msgs.length);
  document.getElementById("msg").textContent = msgs[i];
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
