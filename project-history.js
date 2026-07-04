// project-history.js — shared "My Projects" history store, used by index.html
// (editor exports) and every pdf/*.html page (PDF Hub tool outputs).
//
// Storage: IndexedDB, on this device. The app already uses Firestore, but
// only for a single small `users/{uid}` credits document — there's no
// Firebase Storage bucket to hold arbitrary image/PDF blobs, and Firestore's
// ~1MB document size makes it impractical for that too. IndexedDB is the one
// place in this app that can hold the actual re-downloadable file, so it's
// used here for everyone (signed-in or guest) rather than splitting history
// across two backends that would only agree on the metadata, not the file.
//
// Public API: window.ProjectHistory = { record, list, remove, redownload, formatWhen }
(function () {
  const DB_NAME = 'eraserpro-projects';
  const DB_VERSION = 1;
  const STORE = 'projects';
  const MAX_ITEMS = 50; // oldest entries beyond this are trimmed on every record()

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unsupported')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function trim(db) {
    const all = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    if (all.length <= MAX_ITEMS) return;
    const excess = all.sort((a, b) => a.createdAt - b.createdAt).slice(0, all.length - MAX_ITEMS);
    const tx = db.transaction(STORE, 'readwrite');
    excess.forEach((it) => tx.objectStore(STORE).delete(it.id));
  }

  // { type: 'editor'|'pdf'|'convert', tool, toolLabel, filename, thumbnail (dataURL|null), blob (Blob|null) }
  async function record(entry) {
    try {
      const db = await openDb();
      const item = {
        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        type: entry.type,
        tool: entry.tool,
        toolLabel: entry.toolLabel || entry.tool,
        filename: entry.filename || 'download',
        thumbnail: entry.thumbnail || null,
        blob: entry.blob || null,
        mime: entry.mime || (entry.blob && entry.blob.type) || null,
        createdAt: Date.now(),
      };
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).add(item));
      await trim(db);
      return item.id;
    } catch (e) {
      console.warn('ProjectHistory: failed to record', e);
      return null;
    }
  }

  async function list() {
    try {
      const db = await openDb();
      const all = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
      return all.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.warn('ProjectHistory: failed to list', e);
      return [];
    }
  }

  async function remove(id) {
    try {
      const db = await openDb();
      await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
      return true;
    } catch (e) {
      console.warn('ProjectHistory: failed to remove', e);
      return false;
    }
  }

  // Re-triggers a download of the cached blob. Returns false if the blob
  // isn't available on this device (e.g. history synced elsewhere — can't
  // happen today since storage is device-local, but keeps the API honest).
  async function redownload(id) {
    try {
      const db = await openDb();
      const item = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
      if (!item || !item.blob) return false;
      const url = URL.createObjectURL(item.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) {
      console.warn('ProjectHistory: failed to redownload', e);
      return false;
    }
  }

  // Opens the cached blob in a new tab (view, not force-download) — used by
  // the "re-open" quick action. Same device-local caveat as redownload().
  async function open(id) {
    try {
      const db = await openDb();
      const item = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
      if (!item || !item.blob) return false;
      const url = URL.createObjectURL(item.blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return true;
    } catch (e) {
      console.warn('ProjectHistory: failed to open', e);
      return false;
    }
  }

  function formatWhen(ts) {
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + (diffMin === 1 ? ' minute ago' : ' minutes ago');
    const hrs = Math.floor(diffMin / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  window.ProjectHistory = { record, list, remove, redownload, open, formatWhen };
})();
