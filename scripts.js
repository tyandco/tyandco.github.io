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

  document.addEventListener('DOMContentLoaded', async () => {
    // Initial pass
    await includePartials();
    // Handle one level of nested includes
    await includePartials();
  });

  // Observe future DOM changes and auto-include if new elements are added
  const observer = new MutationObserver(mutations => {
    for (const m of mutations){
      for (const node of m.addedNodes){
        if (node && node.nodeType === 1){
          includePartials(node);
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