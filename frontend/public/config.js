// Runtime config (edit on the server, no rebuild needed).
// Local Vite should use the local FastAPI server; deployed builds use the
// project-scoped nginx proxy.
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

window.__APP_CONFIG__ = {
  apiUrl: isLocal
    ? "http://localhost:8020"
    : "https://neojustin.dothost.net/projects/openalex-research-rag/api",
};
