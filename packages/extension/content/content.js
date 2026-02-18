/**
 * ClauseAI – SaaS contract / Terms of Service page detection
 * Inputs: URL, page metadata, DOM structure, PDF context
 * Outputs: contractDetected flag, "Analyze Terms" prompt trigger
 */

(function () {
  'use strict';

  const SIGNALS = {
    urlPathPatterns: ['terms', 'terms-of-service', 'terms_of_service', 'tos', 'terms-of-use', 'terms_of_use', 'legal', 'agreement', 'user-agreement', 'service-agreement', 'eula', 'license', 'privacy', 'privacy-policy', 'conditions', 'terms-and-conditions', 'contract', 'subscription-terms', 'master-service-agreement', 'msa', 'acceptable-use', 'aup', 'dpa', 'data-processing', 'sla', 'service-level'],
    urlQueryParams: ['terms', 'tos', 'legal', 'agreement', 'eula'],
    titlePatterns: ['terms of service', 'terms of use', 'user agreement', 'service agreement', 'privacy policy', 'terms and conditions', 'end user license', 'eula', 'legal', 'agreement'],
    metaKeywords: ['terms of service', 'terms of use', 'user agreement', 'service agreement', 'end user license', 'eula', 'privacy policy', 'legal agreement', 'subscription agreement', 'master service agreement', 'terms and conditions'],
    linkTextPatterns: ['terms of service', 'terms of use', 'user agreement', 'privacy policy', 'legal', 'agreement', 'eula', 'terms and conditions'],
    headingSelectors: ['h1', 'h2', 'h3', '[role="heading"]'],
    linkSelectors: "a[href*='terms'], a[href*='legal'], a[href*='agreement'], a[href*='privacy'], a[href*='eula']",
    containerSelectors: ['article', '[role="article"]', '.terms-content', '.legal-content', '.tos-content', '#terms', '#legal'],
    pdfTitlePatterns: ['terms', 'agreement', 'legal', 'privacy', 'eula'],
    saasUrlPaths: ['/pricing', '/plans', '/signup', '/sign-up', '/login', '/dashboard', '/api', '/integrations', '/docs', '/developers', '/app'],
    saasHostnamePatterns: ['app.', 'dashboard.', 'cloud.', 'platform.', '.io', '.cloud', '.software', '.app', 'saas'],
    saasLinkTextPatterns: ['pricing', 'plans', 'subscription', 'free trial', 'sign up', 'login', 'dashboard', 'api', 'integrations', 'developers', 'start free trial', 'get started'],
    saasMetaKeywords: ['software as a service', 'saas', 'subscription', 'cloud platform', 'api', 'integrations', 'free trial', 'pricing plans', 'dashboard'],
    /** Pages we never treat as a contract (search, aggregators, etc.). */
    blocklistHostPathPatterns: [
      { host: 'google.', path: '/search' },
      { host: 'bing.com', path: '/search' },
      { host: 'duckduckgo.com', path: '' },
      { host: 'yahoo.com', path: '/search' },
      { host: 'baidu.com', path: '' },
      { host: 'ecosia.org', path: '' },
      { host: 'startpage.com', path: '' },
      { host: 'wikipedia.org', path: '' },
      { host: 'wikimedia.org', path: '' },
    ],
  };

  function normalizeForMatch(text) {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().trim();
  }

  function matchesAny(text, patterns) {
    const n = normalizeForMatch(text);
    return patterns.some((p) => n.includes(p));
  }

  function isBlocklisted() {
    const host = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    return SIGNALS.blocklistHostPathPatterns.some(({ host: h, path: p }) => {
      if (!h || !host.includes(h)) return false;
      if (!p) return true;
      return path.startsWith(p) || path.includes(p);
    });
  }

  function getUrlSignals() {
    const url = window.location.href;
    const path = window.location.pathname.toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    const pathMatch = SIGNALS.urlPathPatterns.some((p) => path.includes(p));
    const queryMatch = SIGNALS.urlQueryParams.some((p) => search.includes(p + '=') || search.includes(p));
    const isPdf = path.endsWith('.pdf') || url.toLowerCase().includes('.pdf');
    return { pathMatch, queryMatch, isPdf, url };
  }

  function getMetaSignals() {
    const title = (document.title || '');
    const titleMatch = matchesAny(title, SIGNALS.titlePatterns);
    let metaMatch = false;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content) metaMatch = matchesAny(metaDesc.content, SIGNALS.metaKeywords);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDesc.content) metaMatch = metaMatch || matchesAny(ogDesc.content, SIGNALS.metaKeywords);
    return { titleMatch, metaMatch };
  }

  function getDomSignals() {
    let headingMatch = false;
    const headingText = [];
    SIGNALS.headingSelectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          const t = (el.textContent || '').trim();
          if (t.length > 0 && t.length < 200) headingText.push(t);
        });
      } catch (_) {}
    });
    headingMatch = headingText.some((t) => matchesAny(t, SIGNALS.titlePatterns.concat(SIGNALS.linkTextPatterns)));

    let linkMatch = false;
    try {
      document.querySelectorAll('a').forEach((a) => {
        const t = (a.textContent || '').trim();
        const h = (a.getAttribute('href') || '');
        if (matchesAny(t, SIGNALS.linkTextPatterns) || SIGNALS.urlPathPatterns.some((p) => h.toLowerCase().includes(p))) linkMatch = true;
      });
    } catch (_) {}

    let containerMatch = false;
    SIGNALS.containerSelectors.forEach((sel) => {
      try {
        if (document.querySelector(sel)) containerMatch = true;
      } catch (_) {}
    });

    return { headingMatch, linkMatch, containerMatch };
  }

  function getPdfSignals() {
    const isPdfUrl = window.location.href.toLowerCase().includes('.pdf') || /\.pdf(\?|$)/i.test(window.location.href);
    const title = document.title || '';
    const pdfTitleMatch = isPdfUrl && matchesAny(title, SIGNALS.pdfTitlePatterns);
    return { isPdfUrl, pdfTitleMatch };
  }

  /**
   * Detects if the site looks like a SaaS product (not just any site with a TOS).
   */
  function getSaaSProductSignals() {
    const hostname = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const hostMatch = SIGNALS.saasHostnamePatterns.some((p) => hostname.includes(p));
    const pathMatch = SIGNALS.saasUrlPaths.some((p) => path.includes(p));

    let linkMatch = false;
    try {
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        const text = (a.textContent || '').trim();
        if (SIGNALS.saasUrlPaths.some((p) => href.includes(p))) linkMatch = true;
        if (matchesAny(text, SIGNALS.saasLinkTextPatterns)) linkMatch = true;
      });
    } catch (_) {}

    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = (metaDesc && metaDesc.content) || '';
    const metaMatch = matchesAny(title + ' ' + desc, SIGNALS.saasMetaKeywords);

    const saasDetected = hostMatch || pathMatch || linkMatch || metaMatch;
    return { hostMatch, pathMatch, linkMatch, metaMatch, saasDetected };
  }

  /**
   * Runs full detection. Only true when:
   * - Page is not blocklisted (e.g. search engines),
   * - URL path looks like a terms/legal page (or PDF with terms in title),
   * - Site looks like a SaaS product.
   */
  function detectSaaSContract() {
    if (isBlocklisted()) {
      return {
        contractDetected: false,
        contractPageDetected: false,
        saasProductDetected: false,
        signals: { blocklisted: true },
        pageTitle: document.title || '',
        url: window.location.href,
      };
    }

    const urlSignals = getUrlSignals();
    const metaSignals = getMetaSignals();
    const domSignals = getDomSignals();
    const pdfSignals = getPdfSignals();
    const saasSignals = getSaaSProductSignals();

    const urlScore = (urlSignals.pathMatch ? 2 : 0) + (urlSignals.queryMatch ? 1 : 0);
    const metaScore = (metaSignals.titleMatch ? 2 : 0) + (metaSignals.metaMatch ? 1 : 0);
    const domScore = (domSignals.headingMatch ? 1 : 0) + (domSignals.linkMatch ? 1 : 0) + (domSignals.containerMatch ? 1 : 0);
    const pdfScore = pdfSignals.isPdfUrl && pdfSignals.pdfTitleMatch ? 2 : 0;

    const total = urlScore + metaScore + domScore + pdfScore;
    const isActuallyTermsPage = urlSignals.pathMatch || (pdfSignals.isPdfUrl && pdfSignals.pdfTitleMatch);
    const contractPageDetected = isActuallyTermsPage && (total >= 1 || metaSignals.titleMatch);
    const contractDetected = !!contractPageDetected && !!saasSignals.saasDetected;

    return {
      contractDetected,
      contractPageDetected,
      saasProductDetected: saasSignals.saasDetected,
      signals: {
        url: urlSignals,
        meta: metaSignals,
        dom: domSignals,
        pdf: pdfSignals,
        saas: saasSignals,
        scores: { url: urlScore, meta: metaScore, dom: domScore, pdf: pdfScore, total },
      },
      pageTitle: document.title || '',
      url: window.location.href,
    };
  }

  function sendToBackground(result) {
    try {
      chrome.runtime.sendMessage({
        type: 'CONTRACT_DETECTION_RESULT',
        payload: result,
      });
    } catch (e) {
      console.warn('ClauseAI: could not notify background', e);
    }
  }

  function showAnalyzeTermsPrompt() {
    if (document.getElementById('clause-ai-analyze-prompt')) return;

    const bar = document.createElement('div');
    bar.id = 'clause-ai-analyze-prompt';
    bar.setAttribute('data-clause-ai', 'analyze-prompt');
    bar.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:2147483646;',
      'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);',
      'color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;',
      'padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;',
      'box-shadow:0 4px 12px rgba(0,0,0,0.25);',
    ].join('');

    const text = document.createElement('span');
    text.textContent = 'SaaS product Terms or contract page detected.';
    text.style.marginRight = '8px';

    const btn = document.createElement('button');
    btn.textContent = 'Analyze Terms';
    btn.style.cssText = [
      'background:#3b82f6;color:#fff;border:none;padding:8px 14px;border-radius:6px;',
      'cursor:pointer;font-weight:600;font-size:13px;',
    ].join('');
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_ANALYZE_TERMS', url: window.location.href, title: document.title });
    });

    const dismiss = document.createElement('button');
    dismiss.textContent = 'Dismiss';
    dismiss.style.cssText = 'background:transparent;color:#94a3b8;border:1px solid #475569;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;';
    dismiss.addEventListener('click', () => {
      if (bar.dataset.clauseAiMargin === 'set') document.body.style.marginTop = '';
      bar.remove();
    });

    bar.appendChild(text);
    bar.appendChild(btn);
    bar.appendChild(dismiss);
    document.documentElement.appendChild(bar);

    if (!document.body.style.marginTop) {
      document.body.style.marginTop = '44px';
      bar.dataset.clauseAiMargin = 'set';
    }
  }

  function runDetection() {
    const result = detectSaaSContract();
    sendToBackground(result);
    if (result.contractDetected) showAnalyzeTermsPrompt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDetection);
  } else {
    runDetection();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'CHECK_CONTRACT') {
      const result = detectSaaSContract();
      sendResponse(result);
    }
  });
})();
