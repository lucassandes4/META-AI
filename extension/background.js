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
