'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  // Listener → Artist: each listener follows 8 random artists (satisfies "at least 5")
  await db.runSql(`
    INSERT INTO follows (follower_id, following_id, created_at)
    SELECT DISTINCT
      l.id,
      a.id,
      NOW() - (FLOOR(RANDOM() * 180) * INTERVAL '1 day')
    FROM users l
    CROSS JOIN LATERAL (
      SELECT id FROM users
      WHERE role = 'artist'
      ORDER BY RANDOM()
      LIMIT 8
    ) a
    WHERE l.role = 'listener'
    ON CONFLICT DO NOTHING;
  `);

  // Artist → Artist: each artist follows 3 other artists (satisfies "2-4")
  await db.runSql(`
    INSERT INTO follows (follower_id, following_id, created_at)
    SELECT DISTINCT
      a1.id,
      a2.id,
      NOW() - (FLOOR(RANDOM() * 300) * INTERVAL '1 day')
    FROM users a1
    CROSS JOIN LATERAL (
      SELECT id FROM users
      WHERE role = 'artist' AND id != a1.id
      ORDER BY RANDOM()
      LIMIT 3
    ) a2
    WHERE a1.role = 'artist'
    ON CONFLICT DO NOTHING;
  `);

  // Listener → Listener: first 10 listeners follow 4 others each ("10 listeners cross-follow")
  await db.runSql(`
    INSERT INTO follows (follower_id, following_id, created_at)
    SELECT DISTINCT
      l1.id,
      l2.id,
      NOW() - (FLOOR(RANDOM() * 90) * INTERVAL '1 day')
    FROM (
      SELECT id FROM users WHERE role = 'listener' ORDER BY created_at LIMIT 10
    ) l1
    CROSS JOIN LATERAL (
      SELECT id FROM users
      WHERE role = 'listener' AND id != l1.id
      ORDER BY RANDOM()
      LIMIT 4
    ) l2
    ON CONFLICT DO NOTHING;
  `);

  // One block for realism (Drake blocks Kendrick — the beef was real)
  await db.runSql(`
    INSERT INTO blocks (blocker_id, blocked_id, created_at)
    SELECT
      (SELECT id FROM users WHERE email = 'drake@rythmify.com'),
      (SELECT id FROM users WHERE email = 'kendricklamar@rythmify.com'),
      NOW() - INTERVAL '10 days'
    WHERE EXISTS (SELECT 1 FROM users WHERE email = 'drake@rythmify.com')
      AND EXISTS (SELECT 1 FROM users WHERE email = 'kendricklamar@rythmify.com')
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (db) {
  await db.runSql(`DELETE FROM blocks;`);
  await db.runSql(`DELETE FROM follows;`);
};

exports._meta = { version: 1 };
