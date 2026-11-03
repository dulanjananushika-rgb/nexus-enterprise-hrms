import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initializeDatabase(): void {
  // In dev/ts mode schema.sql is in src/db, in compiled mode it is in src/db or dist/db
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('[DB] Executing schema DDL migrations...');
  db.exec(schemaSql);

  // Safe incremental column additions for existing installations
  try {
    const leaveCols = db.prepare("PRAGMA table_info(leave_applications);").all() as Array<{ name: string }>;
    const colNames = leaveCols.map((c) => c.name);
    if (!colNames.includes('attachment_name')) {
      db.exec("ALTER TABLE leave_applications ADD COLUMN attachment_name TEXT;");
    }
    if (!colNames.includes('attachment_url')) {
      db.exec("ALTER TABLE leave_applications ADD COLUMN attachment_url TEXT;");
    }
  } catch (migErr) {
    console.warn('[DB Migration Warning]', migErr);
  }

  console.log('[DB] Schema initialized successfully with tables and indexes.');
}

// Direct execution support
if (process.argv[1]?.endsWith('init.ts') || process.argv[1]?.endsWith('init.js')) {
  try {
    initializeDatabase();
    console.log('[DB] Initialization complete.');
  } catch (error) {
    console.error('[DB] Initialization failed:', error);
    process.exit(1);
  }
}
