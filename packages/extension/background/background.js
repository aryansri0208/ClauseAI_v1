/**
 * ClauseAI background – handles contract detection result and "Analyze Terms" trigger.
 * Outputs: badge state, storage of contractDetected, optional sidebar open.
 */

const BADGE = {
  DETECTED: { text: 'TOS', color: '#3b82f6' },
  NONE: { text: '', color: [0, 0, 0, 0] },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONTRACT_DETECTION_RESULT') {
    const { payload } = message;
    const contractDetected = payload && payload.contractDetected === true;
    const tabId = sender.tab && sender.tab.id;

    if (tabId != null) {
      if (contractDetected) {
        chrome.action.setBadgeText({ tabId, text: BADGE.DETECTED.text });
        chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE.DETECTED.color });
      } else {
        chrome.action.setBadgeText({ tabId, text: BADGE.NONE.text });
        chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE.NONE.color });
      }
    }

    chrome.storage.local.set({
      lastContractDetection: {
        contractDetected,
        url: payload?.url,
        pageTitle: payload?.pageTitle,
        signals: payload?.signals,
        tabId: tabId,
        timestamp: Date.now(),
      },
    }).catch(() => {});

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'OPEN_ANALYZE_TERMS') {
    const url = message.url || '';
    const title = message.title || '';

    chrome.storage.local.set({
      analyzeTermsContext: { url, title, timestamp: Date.now() },
    }).catch(() => {});

    if (chrome.sidePanel) {
      chrome.windows.getCurrent().then((win) => {
        chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
      }).catch(() => {});
    }

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_LAST_DETECTION') {
    chrome.storage.local.get('lastContractDetection', (data) => {
      sendResponse(data.lastContractDetection || null);
    });
    return true;
  }
});
