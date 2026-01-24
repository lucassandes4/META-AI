function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      // Ignore errors if the API is unavailable in the current Chrome version.
    });
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "download") {
    const { url, filename } = message.payload;
    chrome.downloads.download({
      url,
      filename,
      conflictAction: "overwrite",
      saveAs: false,
    });
  }

  if (message.type === "log") {
    chrome.runtime.sendMessage(message);
  }

  if (message.type === "batchFinished") {
    chrome.runtime.sendMessage(message);
  }

  if (message.type === "download") {
    sendResponse({ ok: true });
  }
});
