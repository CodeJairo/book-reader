import { Book, BookDetail, ReadingProgress, Annotation } from "../types/book.ts";
import { UserSettings, DEFAULT_SETTINGS } from "../types/settings.ts";

const DB_NAME = "BookReaderDB";
const DB_VERSION = 2;

export class LocalDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("books")) {
          const bookStore = db.createObjectStore("books", { keyPath: "id" });
          bookStore.createIndex("updated_at", "updated_at", { unique: false });
          bookStore.createIndex("is_favorite", "is_favorite", { unique: false });
        }

        if (!db.objectStoreNames.contains("progress")) {
          db.createObjectStore("progress", { keyPath: "book_id" });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("annotations")) {
          const annStore = db.createObjectStore("annotations", { keyPath: "id" });
          annStore.createIndex("book_id", "book_id", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  // --- Books ---
  async getAllBooks(): Promise<Book[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("books", "readonly");
      const store = tx.objectStore("books");
      const request = store.getAll();

      request.onsuccess = () => {
        const books = (request.result as BookDetail[]).map((b) => {
          const { content: _unused, ...summary } = b;
          return summary as Book;
        });
        books.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        resolve(books);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getBook(id: string): Promise<BookDetail | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("books", "readonly");
      const store = tx.objectStore("books");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBook(book: BookDetail): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("books", "readwrite");
      const store = tx.objectStore("books");
      const request = store.put(book);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBook(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["books", "progress", "annotations"], "readwrite");
      tx.objectStore("books").delete(id);
      tx.objectStore("progress").delete(id);

      // Eliminar anotaciones del libro
      const annStore = tx.objectStore("annotations");
      const index = annStore.index("book_id");
      const req = index.getAllKeys(id);
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach((k) => annStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Progress ---
  async getProgress(bookId: string): Promise<ReadingProgress | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("progress", "readonly");
      const store = tx.objectStore("progress");
      const request = store.get(bookId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("progress", "readwrite");
      const store = tx.objectStore("progress");
      const request = store.put(progress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestProgress(): Promise<ReadingProgress | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("progress", "readonly");
      const store = tx.objectStore("progress");
      const request = store.getAll();

      request.onsuccess = () => {
        const all = (request.result as ReadingProgress[]) || [];
        if (all.length === 0) {
          resolve(null);
          return;
        }
        all.sort(
          (a, b) =>
            new Date(b.last_read_at).getTime() -
            new Date(a.last_read_at).getTime()
        );
        resolve(all[0]);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Annotations ---
  async saveAnnotation(annotation: Annotation): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("annotations", "readwrite");
      const store = tx.objectStore("annotations");
      const request = store.put(annotation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAnnotationsByBook(bookId: string): Promise<Annotation[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("annotations", "readonly");
      const store = tx.objectStore("annotations");
      const index = store.index("book_id");
      const request = index.getAll(bookId);

      request.onsuccess = () => {
        const list = (request.result as Annotation[]) || [];
        list.sort((a, b) => a.page_number - b.page_number);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAnnotation(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("annotations", "readwrite");
      const store = tx.objectStore("annotations");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateAnnotation(
    id: string,
    note?: string | null,
    color?: string | null
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("annotations", "readwrite");
      const store = tx.objectStore("annotations");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item: Annotation | undefined = getReq.result;
        if (!item) {
          resolve();
          return;
        }
        if (note !== undefined) item.note = note;
        if (color !== undefined && color !== null) item.color = color;
        store.put(item);
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<UserSettings> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const request = store.get("preferences");

      request.onsuccess = () => {
        if (request.result && request.result.value) {
          resolve({ ...DEFAULT_SETTINGS, ...request.result.value });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      request.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      const store = tx.objectStore("settings");
      const request = store.put({ key: "preferences", value: updated });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const localDB = new LocalDatabase();
