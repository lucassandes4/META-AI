const state = {
  running: false,
  stopRequested: false,
};

function log(message) {
  chrome.runtime.sendMessage({ type: "log", payload: message });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function walkDomWithShadow(root, visitor) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node instanceof Element && node.shadowRoot) {
      stack.push(node.shadowRoot);
    }
    visitor(node);
    if (node.childNodes) {
      stack.push(...node.childNodes);
    }
  }
}

function findFileInput() {
  let found = null;
  walkDomWithShadow(document, (node) => {
    if (found) return;
    if (node instanceof HTMLInputElement && node.type === "file") {
      if (node.accept?.includes("image") || node.accept === "") {
        found = node;
      }
    }
  });
  return found;
}

function findComposer() {
  const candidates = [];
  walkDomWithShadow(document, (node) => {
    if (node instanceof HTMLElement) {
      if (node.isContentEditable) {
        candidates.push(node);
      }
      if (node.tagName === "TEXTAREA") {
        candidates.push(node);
      }
    }
  });
  return candidates[0] || null;
}

function findSendButton() {
  const labels = ["enviar", "send", "gerar", "animate", "criar", "submit"];
  let match = null;
  walkDomWithShadow(document, (node) => {
    if (match) return;
    if (node instanceof HTMLButtonElement) {
      const text = node.innerText?.trim().toLowerCase();
      const aria = node.getAttribute("aria-label")?.toLowerCase();
      if (labels.some((label) => text?.includes(label) || aria?.includes(label))) {
        match = node;
      }
    }
  });
  return match;
}

function findDownloadButtons() {
  const matches = [];
  const labels = ["baixar mídia", "download media", "baixar", "download", "media"];
  walkDomWithShadow(document, (node) => {
    if (node instanceof HTMLElement) {
      const text = node.innerText?.trim().toLowerCase();
      const aria = node.getAttribute("aria-label")?.toLowerCase();
      const role = node.getAttribute("role")?.toLowerCase();
      if (
        (node.tagName === "A" || node.tagName === "BUTTON" || role === "button") &&
        labels.some((label) => text?.includes(label) || aria?.includes(label))
      ) {
        matches.push(node);
      }
    }
  });
  return matches;
}

function toFile(data) {
  const { buffer, name, type } = data;
  return new File([buffer], name, { type });
}

function dispatchFileInput(input, file) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchDrop(target, file) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  const eventInit = { dataTransfer, bubbles: true, cancelable: true };
  target.dispatchEvent(new DragEvent("dragover", eventInit));
  target.dispatchEvent(new DragEvent("drop", eventInit));
}

async function uploadImage(file) {
  const fileInput = findFileInput();
  if (fileInput) {
    dispatchFileInput(fileInput, file);
    log(`Arquivo injetado via input: ${file.name}`);
    return;
  }

  log("Input de arquivo não encontrado. Tentando drag & drop.");
  const dropTarget = document.querySelector("[data-testid*='drop']") || document.body;
  dispatchDrop(dropTarget, file);
  log(`Evento de drop disparado para ${file.name}.`);
}

function setComposerText(composer, text) {
  if (composer.tagName === "TEXTAREA") {
    composer.value = text;
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  composer.focus();
  composer.innerText = text;
  composer.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function findDownloadUrl(button) {
  if (!button) return null;
  if (button instanceof HTMLAnchorElement && button.href) {
    return button.href;
  }

  const href = button.getAttribute("href");
  if (href) return href;

  const dataUrl = button.getAttribute("data-url") || button.getAttribute("data-download-url");
  if (dataUrl) return dataUrl;

  const container = button.closest("article, section, div") || document.body;
  const video = container.querySelector("video");
  if (video?.currentSrc) {
    return video.currentSrc;
  }
  if (video?.src) {
    return video.src;
  }
  return null;
}

async function waitForDownloadButton(previousCount, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (state.stopRequested) return null;
    const buttons = findDownloadButtons();
    if (buttons.length > previousCount) {
      return buttons[buttons.length - 1];
    }
    await delay(2000);
  }
  return null;
}

async function runBatch(files, prompt, timeoutSeconds) {
  state.running = true;
  state.stopRequested = false;

  for (const data of files) {
    if (state.stopRequested) break;

    const file = toFile(data);
    log(`Processando ${file.name}...`);

    const beforeCount = findDownloadButtons().length;
    await uploadImage(file);
    await delay(1000);

    const composer = findComposer();
    if (!composer) {
      log("Campo de texto do chat não encontrado.");
      break;
    }
    setComposerText(composer, prompt);
    await delay(500);

    const sendButton = findSendButton();
    if (!sendButton) {
      log("Botão de envio não encontrado.");
      break;
    }
    sendButton.click();
    log("Mensagem enviada. Aguardando geração do vídeo...");

    const downloadButton = await waitForDownloadButton(
      beforeCount,
      timeoutSeconds * 1000
    );

    if (!downloadButton) {
      log(`Timeout ou parada durante ${file.name}.`);
      continue;
    }

    const url = findDownloadUrl(downloadButton);
    if (!url) {
      log("Não foi possível obter a URL de download. Clique manualmente para validar.");
      continue;
    }

    const targetName = file.name.replace(/\.[^.]+$/, ".mp4");
    chrome.runtime.sendMessage({
      type: "download",
      payload: {
        url,
        filename: targetName,
      },
    });
    log(`Download solicitado: ${targetName}`);
    await delay(2000);
  }

  state.running = false;
  state.stopRequested = false;
  chrome.runtime.sendMessage({ type: "batchFinished" });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "startBatch") {
    if (state.running) {
      log("Batch já em execução.");
      return;
    }
    const { files, prompt, timeoutSeconds } = message.payload;
    runBatch(files, prompt, timeoutSeconds);
  }

  if (message.type === "stopBatch") {
    state.stopRequested = true;
    log("Parada solicitada. Finalizando item atual...");
  }
});
