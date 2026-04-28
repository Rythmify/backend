# Development seed migrations

These migrations are intentionally outside the default `migrations/` directory.
They create or reset demo data for local development and must not run during
production or staging schema migration.

Run them only against disposable local/dev databases:

```sh
$env:ALLOW_DESTRUCTIVE_DEV_SEED='true'; npm run seed:dev
```

The `seed:dev` script uses a separate db-migrate history table named
`dev_seed_migrations` so demo seed state does not mix with schema migration
state. The wrapper refuses to run unless `ALLOW_DESTRUCTIVE_DEV_SEED=true` and
`DATABASE_URL` points at a local database host.

## Classification of moved pending migrations

| Migration | Classification | Notes |
| --- | --- | --- |
| `20260426000001-seed-cleanup` | destructive seed migration | Broadly deletes users, tracks, playlists, activity, messaging, payment/reporting, and related tables. |
| `20260426000002-seed-admins` | local seed migration | Inserts demo admin users. Rollback deletes those demo admins. |
| `20260426000003-seed-artists` | local seed migration | Inserts demo artist users. Rollback deletes demo artists. |
| `20260426000004-seed-users` | local seed migration | Inserts demo listener users. Rollback deletes demo listeners. |
| `20260426000005-seed-genres` | local seed migration | Inserts demo genres and tags. Rollback deletes those names. |
| `20260426000006-seed-follows` | local seed migration | Inserts demo follows/blocks. Rollback broadly deletes follows and blocks. |
| `20260426000007-seed-tracks` | local seed migration | Inserts demo tracks. Rollback deletes demo artist tracks. |
| `20260426000008-seed-track-tags` | local seed migration | Inserts demo track tag joins. Rollback deletes matching joins. |
| `20260426000009-seed-albums` | local seed migration | Inserts demo album playlists and joins. Rollback deletes matching playlist data. |
| `20260426000010-seed-playlists` | local seed migration | Inserts demo playlists and joins. Rollback deletes matching playlist data. |
| `20260426000011-seed-interactions` | local seed migration | Inserts demo likes, reposts, comments, follows. Rollback deletes matching interactions. |
| `20260426000012-seed-listening-history` | local seed migration | Inserts demo listening history. Rollback deletes demo listener history. |
| `20260426000013-seed-extra-tracks` | local seed migration | Inserts extra demo tracks and joins. Rollback deletes matching demo data. |
| `20260426000014-rebuild-seed-tracks-from-assets` | destructive seed migration | Deletes seeded track graph, playlists, interactions, and tracks before rebuilding from local asset manifest. |
| `20260426000015-seed-artist-playlists` | destructive seed migration | Deletes seeded playlist/track graph before recreating artist seed playlists. |
| `20260426000016-fill-artist-playlist-tracks` | local seed migration | Inserts/updates demo artist playlist contents. Rollback deletes matching playlist joins. |
| `20260426000017-restore-static-seed-tracks` | destructive seed migration | Deletes seeded graph and tracks before restoring static demo seed tracks. |

Schema migration classification for this batch: none. All 17 pending files are
seed/demo-data migrations.
