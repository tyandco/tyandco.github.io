(function(){
  async function loadInto(el, url){
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    const html = await res.text();

    // Inject HTML safely via a template, then clone into the target
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    el.innerHTML = '';
    el.appendChild(tpl.content.cloneNode(true));

    // Re-execute any <script> tags inside the included HTML
    const scripts = el.querySelectorAll('script');
    scripts.forEach(old => {
      const s = document.createElement('script');
      // copy all attributes (src, type, async, defer, etc.)
      [...old.attributes].forEach(attr => s.setAttribute(attr.name, attr.value));
      // copy inline script content
      s.textContent = old.textContent;
      // replace old script so the browser executes it
      old.replaceWith(s);
    });
  }

  async function includePartials(root = document){
    // Support both data-include and include-html attributes; skip ones already processed
    const nodes = root.querySelectorAll('[data-include]:not([data-included]), [include-html]:not([data-included])');
    for (const el of nodes){
      const file = el.getAttribute('data-include') || el.getAttribute('include-html');
      if (!file) continue;
      try {
        const url = new URL(file, document.baseURI).toString();
        await loadInto(el, url);
        el.setAttribute('data-included', 'true');
      } catch (err) {
        console.error(err);
        el.innerHTML = '<p>Content not found.</p>';
      }
    }
  }

  function initSectionEffects(root = document){
    const isMobile = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 768px)').matches;
    const maxTilt = isMobile ? 1.75 : 3; // degrees
    const dropZ = isMobile ? 140 : 220; // px
    const scope = root.querySelectorAll ? root.querySelectorAll('section') : [];
    scope.forEach(section => {
      if (section.dataset.sectionFx === 'true') return;
      const delay = 0.04 + Math.random() * (isMobile ? 0.25 : 0.4); // slight stagger
      section.style.setProperty('--section-drop-z', `${dropZ}px`);
      section.style.setProperty('--section-drop-delay', `${delay.toFixed(2)}s`);
      section.dataset.sectionFx = 'true';
    });
  }

  function initResearchStatus(root = document){
    const images = root.querySelectorAll('.research-status-image');
    images.forEach(img => {
      if (img.dataset.statusSwap === 'true') return;
      const loggingSrc = img.getAttribute('data-logging-src') || img.getAttribute('src');
      const waitingSrc = img.getAttribute('data-waiting-src');
      if (!loggingSrc || !waitingSrc) return;

      img.dataset.statusSwap = 'true';

      const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      const showLogging = () => {
        img.src = loggingSrc;
        window.setTimeout(showWaiting, rand(4500, 11000));
      };
      const showWaiting = () => {
        img.src = waitingSrc;
        window.setTimeout(showLogging, rand(500, 1600));
      };

      showLogging();
    });
  }

  function applySoundCloudHtml(container, html, profileUrl){
    container.innerHTML = html || '';
    const iframe = container.querySelector('iframe');
    if (iframe) {
      iframe.classList.add('sc-player');
      if (!iframe.hasAttribute('loading')) {
        iframe.setAttribute('loading', 'lazy');
      }
      if (!iframe.hasAttribute('allow')) {
        iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen');
      }
      if (!iframe.hasAttribute('title')) {
        iframe.setAttribute('title', 'SoundCloud Profile Player');
      }
    } else if (!html) {
      container.innerHTML = `
        <p class="sc-error">
          Unable to load the SoundCloud player right now. 
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer">Open on SoundCloud</a>.
        </p>`;
    }
  }

  function loadSoundCloudJsonp(container, profileUrl, baseParams){
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams(baseParams);
      const callbackName = `scEmbedCallback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      params.set('format', 'json');
      params.set('callback', callbackName);

      const script = document.createElement('script');
      script.src = `https://soundcloud.com/oembed?${params.toString()}`;
      script.async = true;

      const cleanup = () => {
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('SoundCloud JSONP timed out.'));
      }, 10000);

      window[callbackName] = data => {
        clearTimeout(timeoutId);
        cleanup();
        if (data && data.html) {
          applySoundCloudHtml(container, data.html, profileUrl);
          resolve();
        } else {
          reject(new Error('SoundCloud JSONP returned no HTML.'));
        }
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error('SoundCloud JSONP failed to load.'));
      };

      document.head.appendChild(script);
    });
  }

  async function buildSoundCloudEmbed(container){
    const profileUrl = container.getAttribute('data-soundcloud-profile');
    if (!profileUrl) return;

    const baseParams = new URLSearchParams({
      url: profileUrl,
      color: '#5a88cc',
      auto_play: 'false',
      hide_related: 'false',
      show_comments: 'true',
      show_user: 'true',
      show_reposts: 'false',
      show_teaser: 'false',
      visual: 'false'
    });

    container.innerHTML = '<p class="sc-loading">Loading tracks…</p>';

    try {
      const params = new URLSearchParams(baseParams);
      params.set('format', 'json');
      const res = await fetch(`https://soundcloud.com/oembed?${params.toString()}`, {
        credentials: 'omit',
        mode: 'cors'
      });
      if (!res.ok) throw new Error(`SoundCloud responded with ${res.status}`);
      const data = await res.json();
      if (data && data.html) {
        applySoundCloudHtml(container, data.html, profileUrl);
        return;
      }
      throw new Error('SoundCloud response did not include HTML.');
    } catch (err) {
      console.error('[SoundCloud Embed][fetch]', err);
      try {
        await loadSoundCloudJsonp(container, profileUrl, baseParams);
        return;
      } catch (jsonpErr) {
        console.error('[SoundCloud Embed][jsonp]', jsonpErr);
        container.innerHTML = `
          <p class="sc-error">
            Unable to load the SoundCloud player right now. 
            <a href="${profileUrl}" target="_blank" rel="noopener noreferrer">Open on SoundCloud</a>.
          </p>`;
      }
    }
  }

  async function initSoundCloudEmbeds(root = document){
    const nodes = root.querySelectorAll('[data-soundcloud-profile]:not([data-sc-loaded="true"])');
    for (const node of nodes){
      node.setAttribute('data-sc-loaded', 'true');
      await buildSoundCloudEmbed(node);
    }
  }

  function initNavMenus(root = document){
    root.querySelectorAll('.site-nav').forEach(nav => {
      if (nav.dataset.navReady === 'true') return;
      const toggle = nav.querySelector('.nav-toggle');
      const menu = nav.querySelector('.nav-menu');
      if (!toggle || !menu) return;

      nav.dataset.navReady = 'true';
      toggle.setAttribute('aria-expanded', 'false');

      const mobileQuery = window.matchMedia('(max-width: 768px)');

      const overlay = (() => {
        const existing = nav.querySelector('.nav-overlay');
        if (existing) return existing;
        const created = document.createElement('div');
        created.className = 'nav-overlay';
        created.setAttribute('aria-hidden', 'true');
        nav.appendChild(created);
        return created;
      })();

      const setOpen = (open) => {
        const isMobile = mobileQuery.matches;
        nav.classList.toggle('is-open', !!open && isMobile);
        const isOpen = nav.classList.contains('is-open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        document.body.classList.toggle('nav-locked', isOpen);

        menu.querySelectorAll('a').forEach(link => {
          if (isOpen) link.removeAttribute('tabindex');
          else link.setAttribute('tabindex', '-1');
        });

        if ('inert' in menu) {
          if (isOpen) menu.inert = false;
          else menu.inert = true;
        } else {
          if (isOpen) menu.removeAttribute('inert');
          else menu.setAttribute('inert', '');
        }
      };

      const syncMenuState = () => {
        if (!mobileQuery.matches) {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          menu.removeAttribute('aria-hidden');
          overlay.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('nav-locked');
          menu.querySelectorAll('a').forEach(link => link.removeAttribute('tabindex'));
          if ('inert' in menu) menu.inert = false;
          else menu.removeAttribute('inert');
        } else {
          setOpen(nav.classList.contains('is-open'));
        }
      };

      toggle.addEventListener('click', () => {
        const willOpen = !nav.classList.contains('is-open');
        setOpen(willOpen);
      });

      menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (!mobileQuery.matches) return;
          setOpen(false);
        });
      });

      overlay.addEventListener('click', () => setOpen(false));

      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!mobileQuery.matches) return;
        if (!nav.classList.contains('is-open')) return;
        setOpen(false);
      });

      if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', syncMenuState);
      } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(syncMenuState);
      }

      syncMenuState();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Initial pass
    await includePartials();
    // Handle one level of nested includes
    await includePartials();
    await initSoundCloudEmbeds();
    initNavMenus();
    initSectionEffects();
    initResearchStatus();
  });

  // Observe future DOM changes and auto-include if new elements are added
  const observer = new MutationObserver(mutations => {
    for (const m of mutations){
      for (const node of m.addedNodes){
        if (node && node.nodeType === 1){
          includePartials(node)
            .then(() => initSoundCloudEmbeds(node))
            .then(() => initNavMenus(node))
            .then(() => initSectionEffects(node))
            .then(() => initResearchStatus(node));
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
// ---- GitHub Profile + Repos Widget ----
(function(){
  function fmt(n){ try { return new Intl.NumberFormat().format(n); } catch { return n; } }
  function repoCard(repo){
    const updated = new Date(repo.updated_at).toLocaleDateString();
    return `
      <article class="gh-card">
        <h3><a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a></h3>
        ${repo.description ? `<p class="gh-desc">${repo.description}</p>` : ''}
        <div class="gh-meta">
          ${repo.language ? `<span class="gh-lang">${repo.language}</span>` : ''}
          <span>★ ${fmt(repo.stargazers_count)}</span>
          <span>⑂ ${fmt(repo.forks_count)}</span>
          <span>Updated ${updated}</span>
        </div>
      </article>`;
  }
  async function buildGitHubWidget(root){
    const user = root.getAttribute('data-user');
    const errorBox = root.querySelector('.gh-error');
    const profileBox = root.querySelector('.gh-profile');
    const reposBox = root.querySelector('.gh-repos');
    try {
      const [uRes, rRes] = await Promise.all([
        fetch(`https://api.github.com/users/${user}`),
        fetch(`https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=updated`)
      ]);
      if(!uRes.ok) throw new Error(`GitHub user not found: ${user}`);
      const u = await uRes.json();
      let repos = rRes.ok ? await rRes.json() : [];
      repos = repos
        .filter(r => !r.fork)
        .sort((a,b)=> (b.stargazers_count - a.stargazers_count) || (new Date(b.updated_at)-new Date(a.updated_at)) )
        .slice(0, 12);
      profileBox.innerHTML = `
        <div class="gh-profile-inner">
          <a href="${u.html_url}" target="_blank" rel="noopener noreferrer">
            <img class="gh-avatar" src="${u.avatar_url}&s=120" alt="${u.login} avatar"/>
          </a>
          <div>
            <h2 class="gh-name">${u.name || u.login}</h2>
            <p class="gh-bio">${u.bio || ''}</p>
            <p class="gh-stats">
              <a href="${u.html_url}?tab=repositories" target="_blank" rel="noopener noreferrer">Repos: ${fmt(u.public_repos)}</a>
              · Followers: ${fmt(u.followers)} · Following: ${fmt(u.following)}
            </p>
          </div>
        </div>`;
      reposBox.innerHTML = repos.length ? repos.map(repoCard).join('') : '<p>No repositories to show yet.</p>';
    } catch (e){
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = e && e.message ? e.message : 'Failed to load GitHub data.';
      }
      console.error('[GitHub Widget]', e);
    }
  }
  function initGitHubWidgets(){
    document.querySelectorAll('.github-widget[data-user]')
      .forEach(buildGitHubWidget);
  }
  // Run after initial includes have likely populated the DOM
  document.addEventListener('DOMContentLoaded', () => {
    // Allow includePartials() second pass to finish
    setTimeout(initGitHubWidgets, 0);
  });
})();

// ---- GitHub-backed Art Gallery ----
(function(){
  const IMG_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on']);
  const FALSY = new Set(['0', 'false', 'no', 'n', 'off']);
  const STATE_KEY = 'galleryState';
  const CACHE_PREFIX = 'art-gallery::';
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function parseBool(value, fallback = false){
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
    return fallback;
  }

  function normalizePath(path){
    return (path || '').replace(/^\s+|\s+$/g, '').replace(/^\/+|\/+$/g, '');
  }

  function isImageFile(name = ''){
    const lower = name.toLowerCase();
    return IMG_EXTENSIONS.some(ext => lower.endsWith(ext));
  }

  function buildContentsUrl(cfg, path){
    const base = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents`;
    const cleanPath = normalizePath(path);
    const segments = cleanPath ? cleanPath.split('/').map(encodeURIComponent) : [];
    const url = segments.length ? `${base}/${segments.join('/')}` : base;
    const params = new URLSearchParams();
    if (cfg.branch) params.set('ref', cfg.branch);
    return params.toString() ? `${url}?${params.toString()}` : url;
  }

  async function fetchContents(cfg, path){
    const url = buildContentsUrl(cfg, path);
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });

    if (!res.ok){
      let detail = '';
      try {
        const errJson = await res.json();
        if (errJson && errJson.message) detail = errJson.message;
      } catch {
        // ignore JSON parse failures
      }
      const err = new Error(detail || `GitHub request failed (${res.status})`);
      err.status = res.status;
      err.rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
      throw err;
    }

    return res.json();
  }

  async function gatherFiles(cfg){
    const files = [];
    const queue = [normalizePath(cfg.path || '')];
    const visited = new Set();

    while (queue.length){
      const current = queue.shift();
      const key = current || '/';
      if (visited.has(key)) continue;
      visited.add(key);

      const payload = await fetchContents(cfg, current);
      const entries = Array.isArray(payload) ? payload : [payload];

      for (const entry of entries){
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type === 'dir'){
          if (cfg.recursive) queue.push(entry.path);
        } else if (entry.type === 'file' && isImageFile(entry.name)){
          files.push({
            name: entry.name,
            path: entry.path,
            size: entry.size,
            downloadUrl: entry.download_url,
            htmlUrl: entry.html_url,
            sha: entry.sha || ''
          });
        }
      }
    }

    return files;
  }

  function cacheKey(cfg){
    const parts = [
      cfg.user,
      cfg.repo,
      cfg.branch || 'main',
      cfg.recursive ? 'r' : 'nr',
      normalizePath(cfg.path || '') || '.'
    ];
    return `${CACHE_PREFIX}${parts.join('/')}`;
  }

  function readCache(key){
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (!data.timestamp || (Date.now() - data.timestamp) > CACHE_TTL_MS) return null;
      if (!Array.isArray(data.items)) return null;
      return data.items;
    } catch {
      return null;
    }
  }

  function writeCache(key, items){
    try {
      const payload = JSON.stringify({ timestamp: Date.now(), items });
      sessionStorage.setItem(key, payload);
    } catch {
      // Ignore storage quota issues
    }
  }

  function captionParts(name){
    if (!name) return { display: '', extension: '' };
    const extMatch = name.match(/(\.[^.]+)$/);
    const extension = extMatch ? extMatch[1] : '';
    const base = extMatch ? name.slice(0, -extension.length) : name;
    const spaced = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const display = spaced || base || name;
    return { display, extension };
  }

  function applySorting(items, sort){
    const sorted = [...items];
    const localeOpts = { numeric: true, sensitivity: 'base' };
    switch ((sort || '').toLowerCase()){
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, localeOpts));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, localeOpts));
        break;
      case 'path-asc':
        sorted.sort((a, b) => a.path.localeCompare(b.path, undefined, localeOpts));
        break;
      case 'path-desc':
      default:
        sorted.sort((a, b) => b.path.localeCompare(a.path, undefined, localeOpts));
        break;
    }
    return sorted;
  }

  function createFigure(item, captionMode){
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';

    const link = document.createElement('a');
    link.className = 'gallery-link';
    link.href = item.downloadUrl || item.htmlUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    const { display, extension } = captionParts(item.name);
    const captionText = extension ? `${display}${extension}` : display;
    img.className = 'gallery-thumb';
    img.src = item.downloadUrl || item.htmlUrl;
    img.alt = captionMode === 'none' ? item.name : captionText || item.name;
    img.loading = 'lazy';
    img.decoding = 'async';

    link.appendChild(img);
    figure.appendChild(link);

    if (captionMode !== 'none'){
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'gallery-caption';
      figcaption.textContent = captionText || item.name;
      figure.appendChild(figcaption);
    }

    return figure;
  }

  function ensurePager(container){
    let pager = container.querySelector('[data-gallery-pager]');
    if (!pager){
      pager = document.createElement('nav');
      pager.className = 'gallery-pagination';
      pager.setAttribute('data-gallery-pager', '');
      pager.setAttribute('aria-label', 'Art gallery pages');
      pager.hidden = true;
      container.appendChild(pager);
    }

    if (!pager.__galleryHandler){
      pager.addEventListener('click', event => {
        const trigger = event.target.closest('[data-gallery-page]');
        if (!trigger || trigger.hasAttribute('disabled')) return;
        event.preventDefault();
        const desired = parseInt(trigger.getAttribute('data-gallery-page'), 10);
        if (!Number.isFinite(desired)) return;
        hydrateGallery(container, desired);
      });
      pager.__galleryHandler = true;
    }

    return pager;
  }

  function renderPager(pager, page, totalPages){
    if (!pager) return;
    if (totalPages <= 1){
      pager.hidden = true;
      pager.innerHTML = '';
      return;
    }

    const prevPage = page - 1;
    const nextPage = page + 1;
    const prevDisabled = page <= 1 ? 'disabled' : '';
    const nextDisabled = page >= totalPages ? 'disabled' : '';

    pager.hidden = false;
    pager.innerHTML = `
      <button type="button" class="gallery-page-btn" data-gallery-page="${prevPage}" ${prevDisabled}>Previous</button>
      <span class="gallery-page-info">Page ${page} of ${totalPages}</span>
      <button type="button" class="gallery-page-btn" data-gallery-page="${nextPage}" ${nextDisabled}>Next</button>
    `;
  }

  async function hydrateGallery(container, pageOverride){
    if (!container || container.dataset[STATE_KEY] === 'loading') return;

    const config = {
      user: (container.dataset.galleryUser || '').trim(),
      repo: (container.dataset.galleryRepo || '').trim(),
      branch: (container.dataset.galleryBranch || '').trim() || 'main',
      path: container.dataset.galleryPath || '',
      recursive: parseBool(container.dataset.galleryRecursive, true),
      max: parseInt(container.dataset.galleryMax, 10),
      sort: (container.dataset.gallerySort || 'path-desc').trim(),
      caption: (container.dataset.galleryCaption || 'filename').trim().toLowerCase(),
      emptyMessage: container.dataset.galleryEmptyMessage || 'No artwork found yet.',
      errorMessage: container.dataset.galleryErrorMessage || 'Unable to load artwork right now.',
      page: parseInt(container.dataset.galleryPage, 10)
    };

    const statusBox = container.querySelector('[data-gallery-status]');
    const grid = container.querySelector('[data-gallery-grid]');
    const pager = ensurePager(container);
    const desiredPage = Number.isFinite(pageOverride) && pageOverride > 0 ? pageOverride : config.page;
    config.page = Number.isFinite(desiredPage) && desiredPage > 0 ? desiredPage : 1;
    container.dataset.galleryPage = String(config.page);

    const missingConfig = !config.user || !config.repo;
    if (missingConfig){
      if (statusBox){
        statusBox.hidden = false;
        statusBox.textContent = 'Set data-gallery-user and data-gallery-repo to load artwork.';
      }
      if (grid) grid.hidden = true;
      if (pager){
        pager.hidden = true;
        pager.innerHTML = '';
      }
      container.__galleryCacheKey = '';
      container.__galleryItems = null;
      container.dataset[STATE_KEY] = 'idle';
      return;
    }

    container.dataset[STATE_KEY] = 'loading';
    if (statusBox){
      statusBox.hidden = false;
      statusBox.textContent = 'Loading artwork…';
    }
    if (grid){
      grid.hidden = true;
      grid.innerHTML = '';
    }
    if (pager){
      pager.hidden = true;
      pager.innerHTML = '';
    }

    const key = cacheKey(config);
    if (container.__galleryCacheKey !== key){
      container.__galleryCacheKey = key;
      container.__galleryItems = null;
    }

    let items = Array.isArray(container.__galleryItems) ? container.__galleryItems : null;
    if (!items){
      items = readCache(key);
    }

    try {
      if (!items){
        const files = await gatherFiles(config);
        items = files.map(file => ({
          name: file.name,
          path: file.path,
          size: file.size,
          downloadUrl: file.downloadUrl,
          htmlUrl: file.htmlUrl
        }));
        writeCache(key, items);
      }

      container.__galleryItems = items;

      const sorted = applySorting(items, config.sort);
      const pageSize = Number.isFinite(config.max) && config.max > 0 ? config.max : null;
      const totalItems = sorted.length;
      const totalPages = pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

      if (!totalItems){
        if (statusBox){
          statusBox.hidden = false;
          statusBox.textContent = config.emptyMessage;
        }
        if (grid) grid.hidden = true;
        if (pager){
          pager.hidden = true;
          pager.innerHTML = '';
        }
        container.dataset[STATE_KEY] = 'empty';
        return;
      }

      if (config.page > totalPages){
        config.page = totalPages;
        container.dataset.galleryPage = String(config.page);
      }

      const start = pageSize ? (config.page - 1) * pageSize : 0;
      const end = pageSize ? start + pageSize : totalItems;
      const visible = sorted.slice(start, end);

      if (!visible.length){
        if (statusBox){
          statusBox.hidden = false;
          statusBox.textContent = config.emptyMessage;
        }
        if (grid) grid.hidden = true;
        if (pager){
          pager.hidden = totalPages <= 1;
          pager.innerHTML = '';
        }
        container.dataset[STATE_KEY] = 'empty';
        return;
      }

      if (grid){
        grid.innerHTML = '';
        visible.forEach(item => grid.appendChild(createFigure(item, config.caption)));
        grid.hidden = false;
      }
      if (statusBox){
        statusBox.hidden = true;
        statusBox.textContent = '';
      }
      renderPager(pager, config.page, totalPages);
      container.dataset[STATE_KEY] = 'ready';
    } catch (err){
      console.error('[Art Gallery]', err);

      let message = config.errorMessage;
      if (err && err.status === 403 && err.rateLimitRemaining === '0'){
        message = 'GitHub rate limit exceeded. Please try again in a few minutes.';
      } else if (err && err.message){
        message = err.message;
      }

      if (statusBox){
        statusBox.hidden = false;
        statusBox.textContent = message;
      }
      if (grid){
        grid.hidden = true;
        grid.innerHTML = '';
      }
      if (pager){
        pager.hidden = true;
        pager.innerHTML = '';
      }
      container.dataset[STATE_KEY] = 'error';
    }
  }

  function collectTargets(root){
    const targets = [];
    if (!root) return targets;
    if (root.nodeType === 1 && root.matches('[data-gallery]')) targets.push(root);
    if (typeof root.querySelectorAll === 'function'){
      root.querySelectorAll('[data-gallery]').forEach(node => targets.push(node));
    }
    return targets;
  }

  function initArtGalleries(root){
    collectTargets(root || document)
      .forEach(container => hydrateGallery(container));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initArtGalleries(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations){
        for (const node of mutation.addedNodes){
          if (node && (node.nodeType === 1 || node.nodeType === 9)){
            initArtGalleries(node);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  window.refreshArtGalleries = initArtGalleries;
})();
