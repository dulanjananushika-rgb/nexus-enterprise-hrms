import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let poolInstance: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'nexus_hrms'}`;

    poolInstance = new Pool({
      connectionString,
      max: parseInt(process.env.PGMAX_POOL || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool Unexpected Error]', err);
    });
  }

  return poolInstance;
}

export async function checkPostgresConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT version();');
    return {
      connected: true,
      version: result.rows[0]?.version,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown connection error';
    return {
      connected: false,
      error,
    };
  }
}

export async function initializePostgresDatabase(): Promise<void> {
  const pool = getPostgresPool();
  let schemaPath = path.resolve(__dirname, 'schema.postgres.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.postgres.sql');
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('[PostgreSQL] Executing PostgreSQL schema migrations...');
  await pool.query(schemaSql);
  console.log('[PostgreSQL] Database schema initialized successfully.');
}

export async function closePostgresPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
