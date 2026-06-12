"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const pg_1 = require("pg");
async function migrate() {
    const client = new pg_1.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_DIRECT_URL });
    await client.connect();
    await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);
    const migrationsDir = (0, path_1.join)(__dirname, 'migrations');
    const files = (0, fs_1.readdirSync)(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const version = file.replace('.sql', '');
        const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
        if (rowCount && rowCount > 0) {
            console.log(`  skip  ${version}`);
            continue;
        }
        const sql = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf-8');
        await client.query('BEGIN');
        try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
            await client.query('COMMIT');
            console.log(`  apply ${version}`);
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    }
    await client.end();
    console.log('Migrations complete.');
}
migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map