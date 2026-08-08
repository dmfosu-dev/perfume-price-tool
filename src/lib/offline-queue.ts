// Browser-side durable queue for edits made while offline (spec §3.3).
//
// IndexedDB rather than localStorage: the requirement is that queued edits
// survive the app being closed and the phone restarting, and localStorage is
// both synchronous and easily evicted. No library — the surface used here is
// small enough that a dependency would cost more than it saves.

export type QueuedEdit = {
  skuId: string;
  singlePrice: string;
  cartonPrice: string;
  cartonQty: string;
  minimumOrderQty: string;
  stockStatus: string;
  /// lastUpdatedAt as this device saw it, so the server can spot a clash.
  baseUpdatedAt: string | null;
};

export type QueuedBatch = {
  id?: number;
  brandId: string;
  brandName: string;
  edits: QueuedEdit[];
  vendorName: string | null;
  priceCurrency: string;
  queuedAt: number;
};

const DB_NAME = "ppt-offline";
const DB_VERSION = 1;
const STORE = "pending-batches";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueueBatch(batch: Omit<QueuedBatch, "id">): Promise<void> {
  await tx("readwrite", (store) => store.add(batch));
}

export async function listBatches(): Promise<QueuedBatch[]> {
  const all = await tx<QueuedBatch[]>("readonly", (store) => store.getAll());
  // Replay in the order they were made, so a later edit to the same SKU wins.
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeBatch(id: number): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

/// Number of individual SKU changes waiting, not batches — that is what the
/// offline banner reports.
export async function pendingChangeCount(): Promise<number> {
  const batches = await listBatches();
  return batches.reduce((total, batch) => total + batch.edits.length, 0);
}
