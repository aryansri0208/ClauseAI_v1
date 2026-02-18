(function () {
  const contextEl = document.getElementById('context');
  const placeholderEl = document.getElementById('placeholder');

  chrome.storage.local.get(['analyzeTermsContext', 'lastContractDetection'], (data) => {
    const ctx = data.analyzeTermsContext;
    const last = data.lastContractDetection;

    if (ctx && ctx.url) {
      placeholderEl.textContent = '';
      contextEl.innerHTML = '<strong>Page:</strong> ' + (ctx.title || 'Untitled') + '<br/><strong>URL:</strong> ' + ctx.url;
    } else if (last && last.contractDetected && last.url) {
      placeholderEl.textContent = '';
      contextEl.innerHTML = '<strong>Detected:</strong> ' + (last.pageTitle || 'Untitled') + '<br/><strong>URL:</strong> ' + last.url;
    }
  });
})();
