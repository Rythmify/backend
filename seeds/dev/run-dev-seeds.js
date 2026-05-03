'use strict';

require('dotenv').config();

const { spawn } = require('child_process');

const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', 'db', 'rythmify_db']);

function getDatabaseHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return null;
  }
}

const databaseUrl = process.env.DATABASE_URL;
const databaseHost = getDatabaseHost(databaseUrl);
const deployedReseedAllowed = process.env.ALLOW_DESTRUCTIVE_DEPLOYED_RESEED === 'true';
const localDatabase = Boolean(databaseHost && allowedHosts.has(databaseHost));

if (process.env.ALLOW_DESTRUCTIVE_DEV_SEED !== 'true') {
  console.error('Refusing to run destructive dev seeds.');
  console.error('Set ALLOW_DESTRUCTIVE_DEV_SEED=true only for disposable local/dev databases.');
  process.exit(1);
}

if (!localDatabase && !deployedReseedAllowed) {
  console.error(
    `Refusing to run destructive dev seeds against database host: ${databaseHost || 'unknown'}`
  );
  console.error(`Allowed local hosts: ${[...allowedHosts].join(', ')}`);
  console.error(
    'For an intentional deployed reseed, also set ALLOW_DESTRUCTIVE_DEPLOYED_RESEED=true.'
  );
  process.exit(1);
}

const dbMigrateBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const dbMigrateArgs = [
  'db-migrate',
  'up',
  '--migrations-dir',
  'seeds/dev/migrations',
  '--table',
  'dev_seed_migrations',
];
const child = spawn(dbMigrateBin, dbMigrateArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`db-migrate exited via signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
