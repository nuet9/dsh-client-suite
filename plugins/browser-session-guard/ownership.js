const PREFIX = 'mcp__background_browser__';
const PAGE_LINE = /^(\d+):\s(.*)$/;

export class Ownership {
  constructor() { this.pages = new Map(); }
  reset() { this.pages.clear(); }
  owns(owner, id) { return this.pages.get(id) === owner; }
  list(owner) { return [...this.pages].filter(([, value]) => value === owner).map(([id]) => id).sort((a,b) => a-b); }
  check(exec) {
    if (!exec.name.startsWith(PREFIX)) return;
    const owner = exec.agent?.id;
    if (!owner) return 'Browser calls require a session owner.';
    const method = exec.name.slice(PREFIX.length);
    if (method === 'new_page') return;
    if (method === 'list_pages') return 'Global page discovery is disabled. Use background_browser_pages for your own page IDs.';
    const pageId = exec.arguments?.pageId;
    if (!Number.isSafeInteger(pageId) || pageId <= 0 || !this.owns(owner, pageId)) {
      return 'Page is not registered to this session. Create a new page; do not reuse another session\'s pageId.';
    }
  }
  observe(exec, result) {
    if (!exec.name.startsWith(PREFIX) || result.isError || !exec.agent?.id) return;
    const method = exec.name.slice(PREFIX.length);
    if (method === 'new_page') {
      const texts = [];
      const visit = value => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          if (key === 'text' && typeof item === 'string') texts.push(item);
          else visit(item);
        }
      };
      visit(result.value ?? result.content);
      const selected = texts.flatMap(text => [...text.matchAll(/^(\d+):[^\r\n]*\[selected\]/gm)]);
      if (selected.length === 1) this.pages.set(Number(selected[0][1]), exec.agent.id);
    }
    if (method === 'close_page') this.pages.delete(exec.arguments.pageId);
  }
  filterText(text, owner) {
    let inPages = false;
    return text.split('\n').filter(line => {
      if (/^## Pages\s*$/.test(line)) { inPages = true; return true; }
      if (/^## /.test(line)) inPages = false;
      if (!inPages) return true;
      const match = PAGE_LINE.exec(line);
      return !match || this.owns(owner, Number(match[1]));
    }).join('\n');
  }
  sanitize(value, owner) {
    if (Array.isArray(value)) return value.map(item => this.sanitize(item, owner));
    if (!value || typeof value !== 'object') return value;
    const copy = {};
    for (const [key, item] of Object.entries(value)) {
      copy[key] = key === 'text' && typeof item === 'string' ? this.filterText(item, owner) : this.sanitize(item, owner);
    }
    return copy;
  }
}
