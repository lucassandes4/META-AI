const imagePicker = document.getElementById("imagePicker");
const promptInput = document.getElementById("promptInput");
const timeoutInput = document.getElementById("timeoutInput");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const logList = document.getElementById("log");

const state = {
  running: false,
  files: [],
};

function log(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  logList.prepend(item);
}

function setRunning(running) {
  state.running = running;
  startBtn.disabled = running;
  stopBtn.disabled = !running;
}

async function getActiveMetaTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tabs.find((tab) => tab.url?.startsWith("https://www.meta.ai/"));
}

async function readFiles() {
  if (!imagePicker.files?.length) {
    return [];
  }
  const fileEntries = Array.from(imagePicker.files);
  const buffers = await Promise.all(
    fileEntries.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return {
        name: file.name,
        type: file.type || "image/jpeg",
        buffer,
      };
    })
  );
  return buffers;
}

startBtn.addEventListener("click", async () => {
  const activeTab = await getActiveMetaTab();
  if (!activeTab) {
    log("Abra o Meta AI em uma aba ativa antes de iniciar.");
    return;
  }

  const files = await readFiles();
  if (!files.length) {
    log("Selecione pelo menos uma imagem.");
    return;
  }

  const prompt = promptInput.value.trim();
  if (!prompt) {
    log("Digite um prompt antes de iniciar.");
    return;
  }

  const timeoutSeconds = Number(timeoutInput.value) || 180;
  setRunning(true);
  log(`Iniciando lote com ${files.length} imagens.`);

  chrome.tabs.sendMessage(activeTab.id, {
    type: "startBatch",
    payload: {
      files,
      prompt,
      timeoutSeconds,
    },
  });
});

stopBtn.addEventListener("click", async () => {
  const activeTab = await getActiveMetaTab();
  if (!activeTab) {
    log("Nenhuma aba do Meta AI encontrada para parar.");
    return;
  }
  chrome.tabs.sendMessage(activeTab.id, { type: "stopBatch" });
  setRunning(false);
  log("Parada solicitada.");
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "log") {
    log(message.payload);
  }
  if (message.type === "batchFinished") {
    setRunning(false);
    log("Lote concluído.");
  }
});
