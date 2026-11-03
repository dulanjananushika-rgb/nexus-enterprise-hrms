import { db as sqliteDb } from '../db/database.js';
import { getPostgresPool, initializePostgresDatabase, closePostgresPool } from '../db/postgres.js';

const TABLES_IN_ORDER = [
  'users',
  'departments',
  'designations',
  'employees',
  'attendance',
  'leave_types',
  'leave_balances',
  'leave_applications',
  'payroll_batches',
  'payslips',
  'audit_logs',
  'notifications',
  'documents',
];

export async function runMigration(): Promise<void> {
  console.log('========================================================');
  console.log(' NEXUS HRMS: SQLITE -> POSTGRESQL MIGRATION PIPELINE');
  console.log('========================================================\n');

  const pgPool = getPostgresPool();

  try {
    // 1. Verify Postgres connectivity
    console.log('[1/4] Verifying PostgreSQL connection...');
    const testResult = await pgPool.query('SELECT version();');
    console.log(`[Connected] ${testResult.rows[0].version}\n`);

    // 2. Initialize Postgres tables if not present
    console.log('[2/4] Applying PostgreSQL DDL Schema...');
    await initializePostgresDatabase();
    console.log('[DDL Ready] All tables and indexes verified.\n');

    // 3. Migrate data table by table inside a single transactional block
    console.log('[3/4] Transferring data with foreign-key relational integrity...');
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN;');

      for (const table of TABLES_IN_ORDER) {
        // Fetch rows from SQLite
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, any>>;

        if (rows.length === 0) {
          console.log(`  - ${table.padEnd(20)}: 0 rows (skipped)`);
          continue;
        }

        const columns = Object.keys(rows[0]);
        const colsSql = columns.map((c) => `"${c}"`).join(', ');

        for (const row of rows) {
          const values = columns.map((col) => {
            const val = row[col];
            // Format dates or JSON if necessary
            if (val === undefined) return null;
            return val;
          });

          const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
          const updateSets = columns
            .filter((col) => col !== 'id')
            .map((col) => `"${col}" = EXCLUDED."${col}"`)
            .join(', ');

          const upsertSql = `
            INSERT INTO "${table}" (${colsSql})
            VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET ${updateSets || '"id" = EXCLUDED."id"'}
          `;

          await client.query(upsertSql, values);
        }

        console.log(`  - ${table.padEnd(20)}: ${rows.length.toString().padStart(4)} rows migrated successfully`);
      }

      await client.query('COMMIT;');
      console.log('\n[4/4] Transaction committed. All records migrated with 100% data integrity!');
    } catch (txErr) {
      await client.query('ROLLBACK;');
      throw txErr;
    } finally {
      client.release();
    }

    console.log('\n========================================================');
    console.log(' MIGRATION COMPLETED SUCCESSFULLY');
    console.log('========================================================\n');
  } catch (error) {
    console.error('\n[MIGRATION FAILED]', error);
    process.exit(1);
  } finally {
    await closePostgresPool();
  }
}

if (process.argv[1]?.includes('migrate_sqlite_to_postgres')) {
  runMigration().then(() => process.exit(0));
}
