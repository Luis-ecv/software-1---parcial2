// exportDiagram.js
import puppeteer from "puppeteer";

async function exportFullDiagram() {
  const url = "http://localhost:5173/board/3"; // 🔁 cambia por tu URL real
  const output = `./diagrama_completo_${Date.now()}.jpg`;

  console.log("🟢 Abriendo diagrama:", url);

  // Lanzar navegador sin interfaz
  const browser = await puppeteer.launch({
    headless: "new", // usar modo moderno sin ventana
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Abrir la página
  await page.goto(url, { waitUntil: "networkidle0" });

  // 🔧 Ocultar UI que no querés en la imagen
  await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar");
    const fab = document.querySelector(".fab");
    if (sidebar) sidebar.style.display = "none";
    if (fab) fab.style.display = "none";
  });

  // 🧭 Buscar el contenedor del diagrama
  const diagram = await page.$(".react-flow"); // o el id/selector correcto de tu board

  if (!diagram) {
    console.error("❌ No se encontró el contenedor del diagrama (.react-flow).");
    await browser.close();
    return;
  }

  // 📸 Capturar imagen completa del área del diagrama
  await diagram.screenshot({
    path: output,
    type: "jpeg",
    quality: 95,
    captureBeyondViewport: true,
  });

  console.log(`✅ Imagen generada: ${output}`);

  await browser.close();
}

exportFullDiagram().catch(console.error);
