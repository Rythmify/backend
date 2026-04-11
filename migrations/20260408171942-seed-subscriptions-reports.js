'use strict';

// =============================================================
// SEED 09 — subscription_plans, user_subscriptions, transactions,
//           reports
// Depends on: seed-01 (users), seed-03 (tracks)
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // ----------------------------------------------------------
  // SUBSCRIPTION PLANS  (fixed IDs: b000000N-...)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO subscription_plans
      (id, name, price, duration_days, track_limit, playlist_limit)
    VALUES
    ('b0000001-0000-0000-0000-000000000000', 'free',    0.00, NULL, 3,    2),
    ('b0000002-0000-0000-0000-000000000000', 'premium', 4.99, 30,   NULL, NULL)
    ON CONFLICT (name) DO NOTHING;
  `);

  // ----------------------------------------------------------
  // USER SUBSCRIPTIONS  (fixed IDs: 1000000N-...)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO user_subscriptions
      (id, user_id, subscription_plan_id, status, start_date, end_date, auto_renew, created_at)
    VALUES

    -- DJ Karim — active premium
    ('10000001-0000-0000-0000-000000000000',
     '00000002-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'active', '2025-03-01', '2026-03-01', true, NOW()-INTERVAL '120 days'),

    -- Nour — active premium
    ('10000002-0000-0000-0000-000000000000',
     '00000003-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'active', '2025-02-01', '2026-02-01', true, NOW()-INTERVAL '150 days'),

    -- BeatMaker — active premium
    ('10000003-0000-0000-0000-000000000000',
     '00000004-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'active', '2024-12-01', '2025-12-01', false, NOW()-INTERVAL '200 days'),

    -- Layla — expired premium
    ('10000004-0000-0000-0000-000000000000',
     '00000005-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'expired', '2024-06-01', '2025-06-01', false, NOW()-INTERVAL '290 days'),

    -- SynthLord — canceled premium
    ('10000005-0000-0000-0000-000000000000',
     '00000006-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'canceled', '2025-01-01', '2025-07-01', false, NOW()-INTERVAL '180 days'),

    -- Sara (listener) — active premium
    ('10000006-0000-0000-0000-000000000000',
     '00000008-0000-0000-0000-000000000000',
     'b0000002-0000-0000-0000-000000000000',
     'active', '2025-04-01', '2025-05-01', true, NOW()-INTERVAL '30 days'),

    -- Mo — free plan
    ('10000007-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000',
     'b0000001-0000-0000-0000-000000000000',
     'active', '2024-10-01', NULL, false, NOW()-INTERVAL '180 days');
  `);

  // ----------------------------------------------------------
  // TRANSACTIONS  (fixed IDs: 2000000N-...)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO transactions
      (id, user_subscription_id, amount, payment_method, payment_status, paid_at, created_at)
    VALUES

    -- Karim's payments
    ('20000001-0000-0000-0000-000000000000',
     '10000001-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '120 days', NOW()-INTERVAL '120 days'),
    ('20000002-0000-0000-0000-000000000000',
     '10000001-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '90 days', NOW()-INTERVAL '90 days'),
    ('20000003-0000-0000-0000-000000000000',
     '10000001-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '60 days', NOW()-INTERVAL '60 days'),
    ('20000004-0000-0000-0000-000000000000',
     '10000001-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '30 days', NOW()-INTERVAL '30 days'),

    -- Nour's payments
    ('20000005-0000-0000-0000-000000000000',
     '10000002-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '150 days', NOW()-INTERVAL '150 days'),
    ('20000006-0000-0000-0000-000000000000',
     '10000002-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '120 days', NOW()-INTERVAL '120 days'),
    ('20000007-0000-0000-0000-000000000000',
     '10000002-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '90 days',  NOW()-INTERVAL '90 days'),
    ('20000008-0000-0000-0000-000000000000',
     '10000002-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '60 days',  NOW()-INTERVAL '60 days'),
    ('20000009-0000-0000-0000-000000000000',
     '10000002-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid', NOW()-INTERVAL '30 days',  NOW()-INTERVAL '30 days'),

    -- BeatMaker payments
    ('20000010-0000-0000-0000-000000000000',
     '10000003-0000-0000-0000-000000000000',
     4.99, 'mock', 'failed', NULL, NOW()-INTERVAL '205 days'),
    ('20000011-0000-0000-0000-000000000000',
     '10000003-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid',   NOW()-INTERVAL '200 days',NOW()-INTERVAL '200 days'),

    -- Layla payment
    ('20000012-0000-0000-0000-000000000000',
     '10000004-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid',   NOW()-INTERVAL '290 days',NOW()-INTERVAL '290 days'),

    -- SynthLord payment
    ('20000013-0000-0000-0000-000000000000',
     '10000005-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid',   NOW()-INTERVAL '180 days',NOW()-INTERVAL '180 days'),

    -- Sara payment
    ('20000014-0000-0000-0000-000000000000',
     '10000006-0000-0000-0000-000000000000',
     4.99, 'mock', 'paid',   NOW()-INTERVAL '30 days', NOW()-INTERVAL '30 days');
  `);

  // ----------------------------------------------------------
  // REPORTS  (using gen_random_uuid())
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO reports
      (id, reporter_id, resource_type, resource_id, reason,
       description, status, resolved_by, admin_note, resolved_at, created_at)
    VALUES
 
    -- Pending: copyright claim on Street Code
    (gen_random_uuid(),
     '00000008-0000-0000-0000-000000000000',
     'track', 'c0000008-0000-0000-0000-000000000000',
     'copyright',
     'This beat samples an unlicensed 2-bar loop from a well-known label track.',
     'pending', NULL, NULL, NULL, NOW()-INTERVAL '15 days'),
 
    -- Pending: inappropriate content report on a user
    (gen_random_uuid(),
     '00000010-0000-0000-0000-000000000000',
     'user', '00000004-0000-0000-0000-000000000000',
     'spam',
     'This account has been leaving identical promotional comments on dozens of tracks.',
     'pending', NULL, NULL, NULL, NOW()-INTERVAL '8 days'),
 
    -- Resolved: inappropriate track cover
    (gen_random_uuid(),
     '00000012-0000-0000-0000-000000000000',
     'track', 'c0000003-0000-0000-0000-000000000000',
     'inappropriate',
     'Cover art contains imagery that violates community guidelines.',
     'resolved',
     '00000001-0000-0000-0000-000000000000',
     'Reviewed and found compliant. Cover art is stylized but not in violation.',
     NOW()-INTERVAL '20 days',
     NOW()-INTERVAL '25 days'),
 
    -- Dismissed: unfounded copyright claim
    (gen_random_uuid(),
     '00000013-0000-0000-0000-000000000000',
     'track', 'c0000001-0000-0000-0000-000000000000',
     'copyright',
     'I believe this sounds too similar to another artist''s work.',
     'dismissed',
     '00000001-0000-0000-0000-000000000000',
     'No identifiable sample or melodic plagiarism detected. Dismissed.',
     NOW()-INTERVAL '50 days',
     NOW()-INTERVAL '55 days'),
 
    -- Pending: impersonation report on a user
    (gen_random_uuid(),
     '00000014-0000-0000-0000-000000000000',
     'user', '00000007-0000-0000-0000-000000000000',
     'impersonation',
     'This account''s username and bio closely mimics a well-known international artist.',
     'pending', NULL, NULL, NULL, NOW()-INTERVAL '3 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(
    `DELETE FROM reports WHERE reporter_id::text LIKE '0000000%-0000-0000-0000-000000000000';`
  );
  await db.runSql(`DELETE FROM transactions WHERE id::text LIKE '200000%';`);
  await db.runSql(`DELETE FROM user_subscriptions WHERE id::text LIKE '100000%';`);
  await db.runSql(`DELETE FROM subscription_plans WHERE id::text LIKE 'b00000%';`);
};

exports._meta = { version: 1 };
