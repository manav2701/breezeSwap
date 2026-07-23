const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required in environment');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const migrationPath = path.join(__dirname, '../db/migrations/0001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Running migration 0001_init.sql...');
    await client.query(sql);
    console.log('Migration completed successfully!');

    const res = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';');
    console.log('Tables in database:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
