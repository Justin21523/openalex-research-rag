// Resolution order: runtime config.js (editable post-build) → build-time VITE_API_URL → localhost.
const BASE_URL =
  (typeof window !== 'undefined' && window.__APP_CONFIG__?.apiUrl) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8020';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),

  search: (q, { mode = 'hybrid', k = 10, year_from, year_to } = {}) => {
    const p = new URLSearchParams({ q, mode, k: String(k) });
    if (year_from) p.set('year_from', String(year_from));
    if (year_to) p.set('year_to', String(year_to));
    return request(`/search?${p}`);
  },

  getWork: (workId) => request(`/works/${workId}`),

  getCitations: (workId, direction = 'both', limit = 30) =>
    request(`/works/${workId}/citations?direction=${direction}&limit=${limit}`),

  getSimilarWorks: (workId, k = 5) =>
    request(`/works/${workId}/similar?k=${k}`),

  searchAuthors: (q) =>
    request(`/authors/search?q=${encodeURIComponent(q)}`),

  getAuthor: (authorId) => request(`/authors/${authorId}`),

  getTopAuthors: (limit = 20) => request(`/authors/top?limit=${limit}`),

  searchInstitutions: (q) =>
    request(`/institutions/search?q=${encodeURIComponent(q)}`),

  getTopInstitutions: (limit = 20) => request(`/institutions/top?limit=${limit}`),

  getTopWorks: (limit = 20) => request(`/works/top?limit=${limit}`),

  getTopicTrends: ({ concept, year_from, year_to } = {}) => {
    const p = new URLSearchParams();
    if (concept) p.set('concept', concept);
    if (year_from) p.set('year_from', String(year_from));
    if (year_to) p.set('year_to', String(year_to));
    return request(`/topics/trends?${p}`);
  },

  getTopConcepts: (limit = 40) => request(`/topics/concepts?limit=${limit}`),

  getConceptCooccurrence: (top_n = 20, min_weight = 1) =>
    request(`/graph/concept-cooccurrence?top_n=${top_n}&min_weight=${min_weight}`),

  ragAnswer: (query, { top_k = 5, use_extractive_fallback = true, multi_hop = false } = {}) =>
    request('/rag/answer', {
      method: 'POST',
      body: JSON.stringify({ query, top_k, use_extractive_fallback, multi_hop }),
    }),

  pipelineTrace: (q, top_k = 5) =>
    request(`/pipeline/trace?q=${encodeURIComponent(q)}&top_k=${top_k}`),

  // ── Playground ──────────────────────────────────────────────────────────
  playgroundUploadFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE_URL}/playground/upload`, { method: 'POST', body: fd })
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.detail ?? `HTTP ${r.status}`))));
  },

  playgroundUploadJson: (works) =>
    request('/playground/upload-json', {
      method: 'POST',
      body: JSON.stringify({ works }),
    }),

  playgroundUseSample: () =>
    request('/playground/use-sample', { method: 'POST' }),

  playgroundBuildBm25: () =>
    request('/playground/build-bm25', { method: 'POST' }),

  playgroundBuildFts: () =>
    request('/playground/build-fts', { method: 'POST' }),

  playgroundEvaluate: (queries) =>
    request('/playground/evaluate', {
      method: 'POST',
      body: JSON.stringify(queries ? { queries } : {}),
    }),

  playgroundClear: () =>
    request('/playground/clear', { method: 'POST' }),

  playgroundStats: () =>
    request('/playground/stats'),

  // ── Annotations / Notes ─────────────────────────────────────────────────
  getAnnotations: (workId) => request(`/works/${workId}/annotations`),

  addAnnotation: (workId, data) =>
    request(`/works/${workId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAnnotation: (annotationId, data) =>
    request(`/annotations/${annotationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAnnotation: (annotationId) =>
    fetch(`${BASE_URL}/annotations/${annotationId}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok && r.status !== 204) return r.json().then((e) => Promise.reject(new Error(e.detail)));
    }),

  // ── Conversations ────────────────────────────────────────────────────────
  createConversation: (title = 'New Conversation') =>
    request(`/conversations?title=${encodeURIComponent(title)}`, { method: 'POST' }),

  listConversations: () => request('/conversations'),

  getConversation: (sessionId) => request(`/conversations/${sessionId}`),

  deleteConversation: (sessionId) =>
    fetch(`${BASE_URL}/conversations/${sessionId}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok && r.status !== 204) return r.json().then((e) => Promise.reject(new Error(e.detail)));
    }),

  // ── Export ───────────────────────────────────────────────────────────────
  exportWorks: async (workIds, format = 'csv') => {
    const res = await fetch(`${BASE_URL}/export/works`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_ids: workIds, format }),
    });
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = { csv: 'csv', bibtex: 'bib', json: 'json', markdown: 'md' }[format] ?? 'txt';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `works.${ext}`; a.click();
    URL.revokeObjectURL(url);
  },

  exportConversation: async (sessionId, format = 'markdown') => {
    const res = await fetch(
      `${BASE_URL}/export/conversation/${sessionId}?format=${format}`,
    );
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Authors / Co-authors ─────────────────────────────────────────────────
  getCoauthors: (authorId, limit = 20) =>
    request(`/authors/${authorId}/coauthors?limit=${limit}`),

  // ── Topic heatmap ────────────────────────────────────────────────────────
  getTopicHeatmap: (topN = 15, yearFrom = 2015, yearTo = 2024) =>
    request(`/topics/heatmap?top_n=${topN}&year_from=${yearFrom}&year_to=${yearTo}`),

  // ── Citation contexts ────────────────────────────────────────────────────
  getCitationContexts: (workId, limit = 20) =>
    request(`/works/${workId}/citation-contexts?limit=${limit}`),

  // ── Ingest status ────────────────────────────────────────────────────────
  getIngestStatus: () => request('/admin/ingest/status'),

  // ── Reading List ─────────────────────────────────────────────────────────
  getReadingList: (status) =>
    request(`/reading-list${status ? `?status=${status}` : ''}`),
  addToReadingList: (workId) =>
    request(`/reading-list/${workId}`, { method: 'POST' }),
  updateReadingStatus: (workId, status) =>
    request(`/reading-list/${workId}?status=${status}`, { method: 'PATCH' }),
  removeFromReadingList: (workId) =>
    fetch(`${BASE_URL}/reading-list/${workId}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(new Error(e.detail)));
    }),
  getReadingStatus: (workId) => request(`/reading-list/${workId}/status`),

  // ── Import ───────────────────────────────────────────────────────────────
  importByDoi: (doi) =>
    request(`/import/doi?doi=${encodeURIComponent(doi)}`, { method: 'POST' }),
  importByArxiv: (arxivId) =>
    request(`/import/arxiv?arxiv_id=${encodeURIComponent(arxivId)}`, { method: 'POST' }),

  // ── Compare ──────────────────────────────────────────────────────────────
  compareWorks: (workIds) =>
    request('/works/compare', {
      method: 'POST',
      body: JSON.stringify({ work_ids: workIds }),
    }),

  // ── Topic Cluster (UMAP) ─────────────────────────────────────────────────
  getTopicCluster: (topN = 3000) =>
    request(`/topics/cluster?top_n=${topN}`),

  // ── arXiv PDF fetch trigger ───────────────────────────────────────────────
  fetchArxivPdfs: (limit = 500) =>
    request(`/playground/fetch-arxiv-pdfs?limit=${limit}`, { method: 'POST' }),

  // ── Citation trend (by year) ─────────────────────────────────────────────
  getCitationTrend: (workId) => request(`/works/${workId}/citation-trend`),

  // ── Journal analysis ─────────────────────────────────────────────────────
  getJournalStats: (limit = 30, sortBy = 'paper_count') =>
    request(`/topics/journals?limit=${limit}&sort_by=${sortBy}`),

  // ── Topic velocity ───────────────────────────────────────────────────────
  getTopicVelocity: (topN = 15) => request(`/topics/velocity?top_n=${topN}`),

  // ── Paper Timeline ───────────────────────────────────────────────────────
  getPaperTimeline: (year, concept, limit = 20) => {
    const p = new URLSearchParams({ year: String(year), limit: String(limit) });
    if (concept) p.set('concept', concept);
    return request(`/topics/timeline?${p}`);
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  getAnalyticsSummary: () => request('/analytics/summary'),
  getRecentQueries: (limit = 20) => request(`/analytics/recent?limit=${limit}`),
  getYearDistribution: () => request('/analytics/year-distribution'),

  // ── Institutions ─────────────────────────────────────────────────────────
  getInstitution: (institutionId) => request(`/institutions/${institutionId}`),

  // ── All annotations ──────────────────────────────────────────────────────
  getAllAnnotations: (limit = 100) => request(`/annotations/all?limit=${limit}`),
};

/** Async generator that streams embedding build progress via SSE. */
/** Async generator that streams pipeline trace stage-by-stage via SSE.
 *  Yields: {stage: string, data?: object} | {stage: 'done', latencies_ms: object}
 */
export async function* streamPipelineTrace(q, top_k = 5) {
  const res = await fetch(
    `${BASE_URL}/pipeline/trace/stream?q=${encodeURIComponent(q)}&top_k=${top_k}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

export async function* streamBuildEmbeddings() {
  const res = await fetch(`${BASE_URL}/playground/build-embeddings`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

/** Async generator that streams SSE events from POST /rag/answer/stream.
 *  Yields parsed event objects: {type:"token",content:...} or {type:"done",...}
 */
export async function* streamRagAnswer(
  query,
  { top_k = 5, use_extractive_fallback = false, multi_hop = false } = {},
) {
  const res = await fetch(`${BASE_URL}/rag/answer/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k, use_extractive_fallback, multi_hop }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        // skip malformed line
      }
    }
  }
}

/** Stream ingest progress via SSE. */
export async function* streamIngest({ email = '', apiKey = '', limitPerTopic = 6500 } = {}) {
  const p = new URLSearchParams({ limit_per_topic: String(limitPerTopic) });
  if (email) p.set('email', email);
  if (apiKey) p.set('api_key', apiKey);
  const res = await fetch(`${BASE_URL}/admin/ingest/openalex?${p}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

/** Stream conversation ask via SSE. */
export async function* streamConversationAsk(sessionId, query, opts = {}) {
  const { top_k = 5, use_extractive_fallback = false, multi_hop = false } = opts;
  const res = await fetch(`${BASE_URL}/conversations/${sessionId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k, use_extractive_fallback, multi_hop }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

/** Stream AI summary for a single paper. */
export async function* streamWorkSummary(workId) {
  const res = await fetch(`${BASE_URL}/rag/works/${workId}/summarize`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  yield* _parseSSE(res);
}

/** Stream literature review or research gap analysis. */
export async function* streamLiteratureReview({ topic, num_papers = 15, focus = 'review' }) {
  const res = await fetch(`${BASE_URL}/rag/literature-review/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, num_papers, focus }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  yield* _parseSSE(res);
}

/** Stream a topic digest (recent papers summary). */
export async function* streamTopicDigest(concept, topN = 10) {
  const res = await fetch(
    `${BASE_URL}/rag/topic-digest/stream?concept=${encodeURIComponent(concept)}&top_n=${topN}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  yield* _parseSSE(res);
}

async function* _parseSSE(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

export function safeParseJSON(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return val;
  try {
    return JSON.parse(val) ?? fallback;
  } catch {
    return fallback;
  }
}
