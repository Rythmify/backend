// migrations/XXXXXXXXXXXXXX-add-github-to-oauth-provider.js
'use strict';

let dbm;
let type;
let seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  // Add 'github' to the oauth_provider enum
  await db.runSql(`
    ALTER TYPE oauth_provider ADD VALUE IF NOT EXISTS 'github';
  `);
};

exports.down = async function(db) {
  // For simplicity, we'll just log a warning
  console.warn('Cannot remove enum value "github" without recreating the type');
};

exports._meta = {
  version: 1
};
