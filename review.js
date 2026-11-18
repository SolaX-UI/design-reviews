(() => {
  const records = document.getElementById('records');
  const form = document.getElementById('editor');
  const search = document.getElementById('search');
  const status = document.getElementById('status');
  const save = document.getElementById('save');
  const storageKey = 'design-review-catalog-v1';
  const baseCatalog = window.designReviews ?? [];
  const baseline = JSON.stringify(baseCatalog);
  let catalog = structuredClone(baseCatalog);
  let editingId = null;

  if (form) {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey));
      if (draft?.baseline === baseline && Array.isArray(draft.catalog)) catalog = draft.catalog;
    } catch {
      // The exported catalog remains available when browser storage is disabled.
    }
  }

  function validLink(value) {
    if (typeof value !== 'string') return false;
    if (/^https?:\/\/[^\s/]+/i.test(value)) {
      try { return Boolean(new URL(value).hostname); } catch { return false; }
    }
    return /^\.\/projects\/[^\s\\]+\/index\.html$/i.test(value) &&
      !/(?:\.\.|%2e|%2f|%5c)/i.test(value);
  }

  function persist(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ baseline, catalog }));
      status.textContent = message;
    } catch {
      status.textContent = message + ' 当前浏览器无法保存草稿，请下载目录文件。';
    }
    render();
  }

  function addText(parent, tag, content, className = '') {
    const element = document.createElement(tag);
    element.textContent = content;
    element.className = className;
    parent.append(element);
    return element;
  }

  function makeButton(parent, label, action) {
    const button = addText(parent, 'button', label, 'secondary');
    button.type = 'button';
    button.addEventListener('click', action);
  }

  function render() {
    const query = search?.value.trim().toLowerCase() ?? '';
    const filtered = catalog.filter(entry =>
      [entry.name, entry.designer, entry.summary].join(' ').toLowerCase().includes(query)
    ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    records.replaceChildren();
    const count = document.getElementById('count');
    if (count) count.textContent = filtered.length + ' 项评审';
    if (!filtered.length) addText(records, 'p', query ? '没有匹配的评审。' : '暂无评审项目。', 'panel');

    for (const entry of filtered) {
      const card = document.createElement('article');
      card.className = 'card';
      const copy = document.createElement('div');
      card.append(copy);
      addText(copy, 'h2', entry.name);
      addText(copy, 'p', entry.summary);
      addText(copy, 'p', [entry.designer, entry.date, entry.audience].filter(Boolean).join(' · '), 'meta');
      if (form) {
        const controls = document.createElement('div');
        controls.className = 'actions';
        card.append(controls);
        makeButton(controls, '编辑', () => {
          editingId = entry.id;
          for (const key of ['name', 'designer', 'date', 'summary', 'audience', 'url']) form.elements[key].value = entry[key];
          save.textContent = '保存修改';
          form.elements.name.focus();
        });
        makeButton(controls, '移出目录', () => {
          if (!window.confirm('将「' + entry.name + '」从评审目录移出？')) return;
          catalog = catalog.filter(item => item.id !== entry.id);
          if (editingId === entry.id) form.reset();
          persist('已移出目录。请下载新版目录文件。');
        });
      } else if (validLink(entry.url)) {
        const link = addText(card, 'a', '打开评审 ↗', 'button');
        link.href = entry.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', '打开 ' + entry.name + ' 评审');
      }
      records.append(card);
    }
  }

  search?.addEventListener('input', render);
  form?.addEventListener('reset', () => {
    editingId = null;
    save.textContent = '加入目录';
  });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const entry = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    if (!entry.name || !entry.designer || !entry.summary) {
      status.textContent = '请填写项目名称、设计师和一句话看点。';
      return;
    }
    if (!validLink(entry.url)) {
      status.textContent = '请填完整的 HTTP(S) 地址，或 ./projects/项目目录/index.html。';
      form.elements.url.focus();
      return;
    }
    if (editingId) {
      const id = editingId;
      catalog = catalog.map(item => item.id === id ? { id, ...entry } : item);
    } else {
      const id = window.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
      catalog.push({ id, ...entry });
    }
    form.reset();
    persist('已保存登记。请下载新版目录文件，更新评审目录。');
  });
  document.getElementById('export')?.addEventListener('click', () => {
    const content = 'window.designReviews = ' + JSON.stringify(catalog, null, 2) + ';\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/javascript;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalog.js';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = '目录文件已导出。用它替换站点文件夹中的 catalog.js。';
  });
  render();
})();
