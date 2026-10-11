// Download Manager — content script
// 1) In Safari (no downloads API) intercepts clicks on file links.
// 2) Reports <video>/<audio>/<source> URLs and page video to the background script.
// 3) Injects IDM-style floating video download button on video players.
(() => {
  'use strict';
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const DL_EXT = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|dmg|pkg|iso|exe|msi|apk|deb|rpm|pdf|epub|mobi|doc|docx|xls|xlsx|ppt|pptx|mp4|mkv|avi|mov|webm|mp3|flac|wav|m4a|aac|ogg|jar|bin|img|csv|psd|ai|ttf|otf|woff2?)(\?|#|$)/i;

  let state = { online: false, clickIntercept: false, settings: { intercept: true } };

  const IS_FIREFOX = typeof browser !== 'undefined' && String(browser.runtime.getURL('')).startsWith('moz-extension:');

  function refresh() {
    const apply = (r) => { if (r) state = r; };
    try {
      if (IS_FIREFOX) {
        browser.runtime.sendMessage({ type: 'status' }).then(apply, () => {});
      } else {
        api.runtime.sendMessage({ type: 'status' }, (r) => { if (!api.runtime.lastError) apply(r); });
      }
    } catch {}
  }
  refresh();
  setInterval(refresh, 30000);

  // Link click interception
  document.addEventListener('click', (e) => {
    if (!state.clickIntercept || !state.online || !state.settings?.intercept) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.href;
    if (!/^https?:/i.test(href)) return;
    const list = state.captureExtensions || [];
    const m = href.split(/[?#]/)[0].match(/\.([a-z0-9]{1,8})$/i);
    const ext = m ? m[1].toLowerCase() : '';
    if (list.length ? !(ext && list.includes(ext)) : !(a.hasAttribute('download') || DL_EXT.test(href))) return;
    e.preventDefault();
    e.stopPropagation();
    api.runtime.sendMessage({ type: 'download', url: href, filename: a.getAttribute('download') || '', referer: location.href, kind: 'file' });
  }, true);

  // Video & Media Detection
  const reported = new Set();
  const isVideoSite = /youtube\.com|youtu\.be|x\.com|twitter\.com|instagram\.com|tiktok\.com|vimeo\.com|facebook\.com|reddit\.com|dailymotion\.com|twitch\.tv/i.test(location.hostname);

  function getBestMediaTitle(video) {
    try {
      if (/youtube\.com|youtu\.be/i.test(location.hostname)) {
        const ytPlayerTitle = document.querySelector('.ytp-title-link')?.textContent?.trim();
        if (ytPlayerTitle && ytPlayerTitle !== 'YouTube') return ytPlayerTitle;

        const ytHeading = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #above-the-fold #title h1, h1.title yt-formatted-string, ytd-watch-metadata h1')?.textContent?.trim();
        if (ytHeading && ytHeading !== 'YouTube') return ytHeading;

        const ytMeta = document.querySelector('meta[name="title"]')?.getAttribute('content')?.trim();
        if (ytMeta && ytMeta !== 'YouTube') return ytMeta;
      }

      if (/x\.com|twitter\.com/i.test(location.hostname)) {
        const tweetText = document.querySelector('article div[data-testid="tweetText"]')?.textContent?.trim();
        if (tweetText) return tweetText.slice(0, 80);
      }

      if (/instagram\.com/i.test(location.hostname)) {
        const igMeta = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
        if (igMeta) return igMeta;
      }

      const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute('content')?.trim();
      if (ogTitle && ogTitle !== 'YouTube' && ogTitle !== 'X' && ogTitle !== 'Twitter') {
        return ogTitle;
      }

      if (video) {
        const titleAttr = video.getAttribute('title') || video.getAttribute('aria-label');
        if (titleAttr && titleAttr.trim()) return titleAttr.trim();
      }

      let docTitle = document.title ? document.title.trim() : '';
      docTitle = docTitle.replace(/^\(\d+\)\s*/, '');
      docTitle = docTitle.replace(/\s*-\s*YouTube$/i, '');
      docTitle = docTitle.replace(/\s*\/\s*X$/i, '');
      if (docTitle && docTitle !== 'YouTube' && docTitle !== 'X') {
        return docTitle;
      }
    } catch {}
    return '';
  }

  function scanMedia() {
    const items = [];
    const videos = document.querySelectorAll('video');

    if (videos.length > 0 || isVideoSite) {
      if (!reported.has(location.href)) {
        reported.add(location.href);
        const title = getBestMediaTitle(videos[0]);
        items.push({
          url: location.href,
          type: 'video/mp4',
          kind: 'video',
          name: title || (document.title ? document.title.slice(0, 80) : 'Video')
        });
      }
    }

    document.querySelectorAll('video, audio, source').forEach((el) => {
      const src = el.currentSrc || el.src || el.getAttribute('src');
      if (!src || !/^https?:/i.test(src) || reported.has(src)) return;
      reported.add(src);
      const title = getBestMediaTitle(el);
      items.push({ url: src, type: el.getAttribute('type') || '', name: title || (document.title ? document.title.slice(0, 80) : '') });
    });

    if (items.length) {
      try { api.runtime.sendMessage({ type: 'pageMedia', items }); } catch {}
    }

    // Attach floating button to videos
    videos.forEach(attachFloatingButton);
  }

  // IDM-Style Floating Video Download Button
  function attachFloatingButton(video) {
    if (!video || video.dataset.dmAttached || video.offsetWidth < 120 || video.offsetHeight < 80) return;
    video.dataset.dmAttached = 'true';

    // Find the topmost video player container (especially on YouTube / HTML5 players)
    const playerContainer = video.closest('.html5-video-player, ytd-player, #movie_player, .video-player, .player-container, .vjs-player') || video.parentElement;
    if (!playerContainer) return;

    // Prevent duplicate buttons on the same player
    if (playerContainer.querySelector('.dm-video-download-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'dm-video-download-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Videoyu İndir</span>
    `;

    Object.assign(btn.style, {
      position: 'absolute',
      top: '14px',
      right: '14px',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      gap: '6px',
      padding: '7px 13px',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      color: '#ffffff',
      fontSize: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
      cursor: 'pointer',
      userSelect: 'none',
      backdropFilter: 'blur(6px)',
      transition: 'opacity 0.2s ease, transform 0.15s ease',
      pointerEvents: 'auto',
      opacity: '0'
    });

    const compStyle = window.getComputedStyle(playerContainer);
    if (compStyle.position === 'static') {
      playerContainer.style.position = 'relative';
    }

    playerContainer.appendChild(btn);

    let hideTimer = null;
    let isInside = false;

    const showButton = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      btn.style.display = 'flex';
      // Small tick for smooth opacity transition
      requestAnimationFrame(() => {
        btn.style.opacity = '1';
      });
    };

    const scheduleHide = (delay = 1200) => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isInside) {
          btn.style.opacity = '0';
          setTimeout(() => {
            if (!isInside && btn.style.opacity === '0') {
              btn.style.display = 'none';
            }
          }, 200);
        }
      }, delay);
    };

    // Keep button visible on any mouse movement inside player container
    playerContainer.addEventListener('mouseenter', () => {
      isInside = true;
      showButton();
    });

    playerContainer.addEventListener('mousemove', () => {
      isInside = true;
      showButton();
    });

    playerContainer.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget && playerContainer.contains(e.relatedTarget)) {
        return; // Still within player bounds
      }
      isInside = false;
      scheduleHide(600);
    });

    btn.addEventListener('mouseenter', () => {
      isInside = true;
      showButton();
    });

    btn.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget && playerContainer.contains(e.relatedTarget)) {
        isInside = true;
      } else {
        isInside = false;
        scheduleHide(600);
      }
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.style.opacity = '0.7';
      btn.querySelector('span').textContent = 'Gönderiliyor…';

      const videoUrl = isVideoSite ? location.href : (video.currentSrc || video.src || location.href);
      const isDirectFile = !isVideoSite && /^https?:.*\.mp4/i.test(videoUrl);

      const title = getBestMediaTitle(video);

      api.runtime.sendMessage(
        {
          type: 'download',
          url: videoUrl,
          filename: title || (document.title ? document.title.slice(0, 80) : ''),
          referer: location.href,
          kind: isDirectFile ? 'file' : 'video'
        },
        (r) => {
          if (r && r.ok) {
            btn.querySelector('span').textContent = '✓ Başlatıldı';
          } else {
            btn.querySelector('span').textContent = 'Hata';
          }
          setTimeout(() => {
            btn.style.opacity = '1';
            btn.querySelector('span').textContent = 'Videoyu İndir';
          }, 3000);
        }
      );
    });
  }

  scanMedia();
  document.addEventListener('play', scanMedia, true);
  document.addEventListener('loadedmetadata', scanMedia, true);
  let n = 0;
  const iv = setInterval(() => { scanMedia(); if (++n > 20) clearInterval(iv); }, 3000);
})();
