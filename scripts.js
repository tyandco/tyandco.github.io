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
      show_teaser: 'true',
      visual: 'false'
    });

    container.innerHTML = '<p class="sc-loading">Loading tracks… \n(On mobile and/or not loading? Click the button below, it takes you to my profile!)</p>';

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

      const syncMenuVisibility = () => {
        const isMobile = mobileQuery.matches;
        if (!isMobile) {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          menu.hidden = false;
        } else {
          menu.hidden = !nav.classList.contains('is-open');
        }
      };

      toggle.addEventListener('click', () => {
        const willOpen = !nav.classList.contains('is-open');
        nav.classList.toggle('is-open', willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        syncMenuVisibility();
      });

      menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (!mobileQuery.matches) return;
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          syncMenuVisibility();
        });
      });

      if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', syncMenuVisibility);
      } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(syncMenuVisibility);
      }

      syncMenuVisibility();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Initial pass
    await includePartials();
    // Handle one level of nested includes
    await includePartials();
    await initSoundCloudEmbeds();
    initNavMenus();
  });

  // Observe future DOM changes and auto-include if new elements are added
  const observer = new MutationObserver(mutations => {
    for (const m of mutations){
      for (const node of m.addedNodes){
        if (node && node.nodeType === 1){
          includePartials(node)
            .then(() => initSoundCloudEmbeds(node))
            .then(() => initNavMenus(node));
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
