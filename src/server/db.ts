import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  durationSeconds: number;
  createdAt: string;
}

export interface TranscriptionRepo {
  insert(record: { filename: string; text: string; durationSeconds: number }): TranscriptionRecord;
  list(): TranscriptionRecord[];
  get(id: number): TranscriptionRecord | undefined;
  remove(id: number): boolean;
  close(): void;
}

interface TranscriptionRow {
  id: number;
  filename: string;
  text: string;
  duration_seconds: number;
  created_at: string;
}

function rowToRecord(row: TranscriptionRow): TranscriptionRecord {
  return {
    id: row.id,
    filename: row.filename,
    text: row.text,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
  };
}

export function createTranscriptionRepo(dbPath: string): TranscriptionRepo {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      text TEXT NOT NULL,
      duration_seconds REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return {
    insert({ filename, text, durationSeconds }) {
      const stmt = db.prepare(
        'INSERT INTO transcriptions (filename, text, duration_seconds) VALUES (?, ?, ?)'
      );
      const info = stmt.run(filename, text, durationSeconds);
      const row = db
        .prepare('SELECT * FROM transcriptions WHERE id = ?')
        .get(info.lastInsertRowid) as TranscriptionRow;
      return rowToRecord(row);
    },
    list() {
      const rows = db
        .prepare('SELECT * FROM transcriptions ORDER BY created_at DESC, id DESC')
        .all() as TranscriptionRow[];
      return rows.map(rowToRecord);
    },
    get(id) {
      const row = db.prepare('SELECT * FROM transcriptions WHERE id = ?').get(id) as
        | TranscriptionRow
        | undefined;
      return row ? rowToRecord(row) : undefined;
    },
    remove(id) {
      const info = db.prepare('DELETE FROM transcriptions WHERE id = ?').run(id);
      return info.changes > 0;
    },
    close() {
      db.close();
    },
  };
}
