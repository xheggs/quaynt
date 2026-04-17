/*! Quaynt AI Attribution Snippet v1 — privacy-first, cookieless, no fingerprinting.
 *  Docs: https://docs.quaynt.io/integrations/ai-traffic-attribution
 *  Source: https://github.com/xheggs/quaynt
 */
(function () {
  'use strict';

  var OPT_OUT_KEY = 'quaynt-opt-out';

  // AI source host substrings — the same list the server uses. Client-side pre-filter
  // only; the collector re-validates every request.
  var AI_HOSTS = [
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'perplexity.ai',
    'gemini.google.com',
    'bard.google.com',
    'claude.ai',
    'copilot.microsoft.com',
    'you.com',
    'search.brave.com',
    'grok.com',
    'deepseek.com',
    'meta.ai',
    'chat.mistral.ai',
    'phind.com',
    'andisearch.com'
  ];
  var AI_UTM_VALUES = [
    'chatgpt.com', 'chatgpt', 'openai', 'perplexity',
    'gemini', 'bard', 'claude', 'claude.ai', 'copilot', 'bing-copilot',
    'you.com', 'you', 'brave', 'grok', 'deepseek',
    'meta-ai', 'metaai', 'mistral', 'le-chat', 'phind', 'andi', 'andisearch'
  ];

  function currentScript() {
    if (document.currentScript) return document.currentScript;
    var list = document.getElementsByTagName('script');
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].getAttribute('data-site-key')) return list[i];
    }
    return null;
  }

  function detectUaFamily(ua) {
    if (!ua) return 'Other';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Other';
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); }
    catch (e) { return ''; }
  }

  function matchesAi(referrer, utm) {
    if (referrer) {
      var h = hostOf(referrer);
      for (var i = 0; i < AI_HOSTS.length; i++) {
        if (h === AI_HOSTS[i] || h.indexOf('.' + AI_HOSTS[i]) !== -1 || h.indexOf(AI_HOSTS[i]) !== -1) {
          return true;
        }
      }
    }
    if (utm) {
      var u = utm.toLowerCase();
      for (var j = 0; j < AI_UTM_VALUES.length; j++) {
        if (u === AI_UTM_VALUES[j]) return true;
      }
    }
    return false;
  }

  function isOptedOut() {
    if (navigator.doNotTrack === '1') return true;
    if (navigator.globalPrivacyControl === true) return true;
    if (window.QuayntAttribution && window.QuayntAttribution.optedOut === true) return true;
    try {
      if (window.localStorage && window.localStorage.getItem(OPT_OUT_KEY)) return true;
    } catch (e) { /* storage disabled — ignore */ }
    return false;
  }

  function send(collectorUrl, siteKey, payload) {
    var url = collectorUrl.replace(/\/$/, '') + '/api/v1/traffic/collect/' + encodeURIComponent(siteKey);
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (e) { /* fall through to fetch */ }
    try {
      if (typeof fetch === 'function') {
        fetch(url, {
          method: 'POST',
          body: body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          mode: 'no-cors',
          credentials: 'omit'
        }).catch(function () { /* network errors ignored */ });
      }
    } catch (e) { /* ignore */ }
  }

  function run() {
    if (isOptedOut()) return;

    var script = currentScript();
    if (!script) return;

    var siteKey = script.getAttribute('data-site-key');
    if (!siteKey) return;
    var collectorUrl = script.getAttribute('data-collector') || (location.protocol + '//' + location.host);

    var referrer = document.referrer || '';
    var utm = '';
    try {
      utm = new URL(location.href).searchParams.get('utm_source') || '';
    } catch (e) { utm = ''; }

    if (!referrer && !utm) return;
    if (!matchesAi(referrer, utm)) return;

    var payload = {
      referrer: referrer || null,
      landingPath: location.pathname + location.search,
      userAgentFamily: detectUaFamily(navigator.userAgent || '')
    };

    send(collectorUrl, siteKey, payload);
  }

  // Public opt-out API.
  window.QuayntAttribution = window.QuayntAttribution || {};
  window.QuayntAttribution.optOut = function () {
    try { window.localStorage.setItem(OPT_OUT_KEY, '1'); } catch (e) { /* ignore */ }
    window.QuayntAttribution.optedOut = true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
