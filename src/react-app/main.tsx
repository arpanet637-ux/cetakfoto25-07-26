import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import { initLocalDb } from "@/react-app/lib/local-db";
import { initLocalAuth } from "@/react-app/lib/local-auth";

const root = createRoot(document.getElementById("root")!);

function render() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Seed the local database once before the first render so every page has data.
// Any failure still renders the app instead of leaving a blank screen.
Promise.all([initLocalDb(), initLocalAuth()])
  .catch((err) => {
    console.error("[bisnisKu] Inisialisasi data lokal gagal:", err);
  })
  .finally(render);
