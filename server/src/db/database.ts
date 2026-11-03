import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standardized DB directory relative to server package
const DB_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'nexus_hrms.db');

export class DatabaseManager {
  private static instance: DatabaseSync | null = null;

  public static getDb(): DatabaseSync {
    if (!this.instance) {
      this.instance = new DatabaseSync(DB_PATH);
      // Enable WAL journal mode for high performance concurrent reads
      this.instance.exec('PRAGMA journal_mode = WAL;');
      this.instance.exec('PRAGMA foreign_keys = ON;');
      this.instance.exec('PRAGMA synchronous = NORMAL;');
    }
    return this.instance;
  }

  public static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

export const db = DatabaseManager.getDb();
