import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  projectTag: string | null;
  durationSeconds: number;
  withTimestamps: boolean;
  createdAt: string;
}

export interface TranscriptionRepo {
  insert(record: {
    filename: string;
    text: string;
    projectTag?: string | null;
    durationSeconds: number;
    withTimestamps: boolean;
  }): TranscriptionRecord;
  list(projectTag?: string): TranscriptionRecord[];
  listTags(): string[];
  get(id: number): TranscriptionRecord | undefined;
  update(id: number, changes: { text?: string; projectTag?: string | null }): TranscriptionRecord | undefined;
  remove(id: number): boolean;
  close(): void;
}

interface TranscriptionRow {
  id: number;
  filename: string;
  text: string;
  project_tag: string | null;
  duration_seconds: number;
  with_timestamps: number;
  created_at: string;
}

function rowToRecord(row: TranscriptionRow): TranscriptionRecord {
  return {
    id: row.id,
    filename: row.filename,
    text: row.text,
    projectTag: row.project_tag,
    durationSeconds: row.duration_seconds,
    withTimestamps: Boolean(row.with_timestamps),
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
      project_tag TEXT,
      duration_seconds REAL NOT NULL,
      with_timestamps INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  const columns = db.prepare('PRAGMA table_info(transcriptions)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'with_timestamps')) {
    db.exec('ALTER TABLE transcriptions ADD COLUMN with_timestamps INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.some((column) => column.name === 'project_tag')) {
    db.exec('ALTER TABLE transcriptions ADD COLUMN project_tag TEXT');
  }

  return {
    insert({ filename, text, projectTag = null, durationSeconds, withTimestamps }) {
      const stmt = db.prepare(
        'INSERT INTO transcriptions (filename, text, project_tag, duration_seconds, with_timestamps, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const info = stmt.run(
        filename,
        text,
        projectTag,
        durationSeconds,
        withTimestamps ? 1 : 0,
        new Date().toISOString()
      );
      const row = db
        .prepare('SELECT * FROM transcriptions WHERE id = ?')
        .get(info.lastInsertRowid) as TranscriptionRow;
      return rowToRecord(row);
    },
    list(projectTag) {
      const rows = projectTag === undefined
        ? (db
            .prepare('SELECT * FROM transcriptions ORDER BY created_at DESC, id DESC')
            .all() as TranscriptionRow[])
        : (db
            .prepare(
              'SELECT * FROM transcriptions WHERE project_tag = ? ORDER BY created_at DESC, id DESC'
            )
            .all(projectTag) as TranscriptionRow[]);
      return rows.map(rowToRecord);
    },
    listTags() {
      const rows = db
        .prepare(
          "SELECT DISTINCT project_tag FROM transcriptions WHERE project_tag IS NOT NULL AND project_tag != '' ORDER BY project_tag COLLATE NOCASE"
        )
        .all() as { project_tag: string }[];
      return rows.map((row) => row.project_tag);
    },
    get(id) {
      const row = db.prepare('SELECT * FROM transcriptions WHERE id = ?').get(id) as
        | TranscriptionRow
        | undefined;
      return row ? rowToRecord(row) : undefined;
    },
    update(id, changes) {
      const columns: string[] = [];
      const values: (string | null)[] = [];
      if (changes.text !== undefined) {
        columns.push('text = ?');
        values.push(changes.text);
      }
      if (changes.projectTag !== undefined) {
        columns.push('project_tag = ?');
        values.push(changes.projectTag);
      }
      if (columns.length === 0) return this.get(id);

      const info = db.prepare(`UPDATE transcriptions SET ${columns.join(', ')} WHERE id = ?`).run(...values, id);
      if (info.changes === 0) return undefined;
      return this.get(id);
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
