/**
 * MongoDB docker-entrypoint-initdb.d script (runs once on empty data volume).
 * Ensures the accountability database exists for local compose stacks.
 */
const dbName = 'accountability';
const target = db.getSiblingDB(dbName);

if (!target.getCollectionNames().includes('logs')) {
  target.createCollection('logs');
}

print(`init-mongo: ${dbName} ready`);
