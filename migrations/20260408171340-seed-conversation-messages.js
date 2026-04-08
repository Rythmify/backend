'use strict';

// =============================================================
// SEED 08 — conversations, messages
// Depends on: seed-01 (users), seed-03 (tracks)
//
// CONSTRAINT: conversations.user_a_id < user_b_id  (UUID order)
// All seed user IDs start '0000000N-...' so the ordering is:
//   00000002 < 00000003 < ... < 00000014
// Validate before inserting: user_a_id must be lexically smaller.
// =============================================================

let dbm, type, seed;
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

// helper — caller must ensure a < b (UUID lexicographic order)
// conversation IDs: a000000N-...
const CONVO = (n) => `a${String(n).padStart(7,'0')}-0000-0000-0000-000000000000`;

exports.up = async function (db) {

  // ----------------------------------------------------------
  // CONVERSATIONS  (fixed IDs so messages can reference them)
  // 00000002 < 00000008 ✓  (karim ↔ sara)
  // 00000003 < 00000010 ✓  (nour ↔ fatma)
  // 00000004 < 00000009 ✓  (beatmaker ↔ mo)
  // 00000005 < 00000010 ✓  (layla ↔ fatma) — already covered above but different pair
  // 00000008 < 00000009 ✓  (sara ↔ mo)
  // 00000002 < 00000009 ✓  (karim ↔ mo)
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO conversations
      (id, user_a_id, user_b_id, created_at, last_message_at, deleted_by_a, deleted_by_b)
    VALUES
    ('${CONVO(1)}',
     '00000002-0000-0000-0000-000000000000',
     '00000008-0000-0000-0000-000000000000',
     NOW()-INTERVAL '60 days', NOW()-INTERVAL '1 day', false, false),

    ('${CONVO(2)}',
     '00000003-0000-0000-0000-000000000000',
     '00000010-0000-0000-0000-000000000000',
     NOW()-INTERVAL '50 days', NOW()-INTERVAL '5 days', false, false),

    ('${CONVO(3)}',
     '00000004-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000',
     NOW()-INTERVAL '45 days', NOW()-INTERVAL '3 days', false, false),

    ('${CONVO(4)}',
     '00000005-0000-0000-0000-000000000000',
     '00000012-0000-0000-0000-000000000000',
     NOW()-INTERVAL '40 days', NOW()-INTERVAL '10 days', false, false),

    ('${CONVO(5)}',
     '00000008-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000',
     NOW()-INTERVAL '35 days', NOW()-INTERVAL '2 days', false, false),

    ('${CONVO(6)}',
     '00000002-0000-0000-0000-000000000000',
     '00000009-0000-0000-0000-000000000000',
     NOW()-INTERVAL '30 days', NOW()-INTERVAL '6 hours', false, false);
  `);

  // ----------------------------------------------------------
  // MESSAGES
  // sender_id must be one of the two conversation participants.
  // trg_messages_sender_check enforces this.
  // trg_conversation_last_message_at updates last_message_at.
  // ----------------------------------------------------------
  await db.runSql(`
    INSERT INTO messages
      (id, conversation_id, sender_id, content, embed_type, embed_id, is_read, created_at)
    VALUES

    -- ── Convo 1: Karim ↔ Sara ─────────────────────────────
    (gen_random_uuid(),'${CONVO(1)}','00000008-0000-0000-0000-000000000000',
     'Hey Karim! Midnight Run is incredible — been on loop all week 🎶',
     NULL, NULL, true,  NOW()-INTERVAL '60 days'),

    (gen_random_uuid(),'${CONVO(1)}','00000002-0000-0000-0000-000000000000',
     'Thank you so much Sara! That really means a lot 🙏',
     NULL, NULL, true,  NOW()-INTERVAL '59 days'),

    (gen_random_uuid(),'${CONVO(1)}','00000008-0000-0000-0000-000000000000',
     'Will there be a follow-up EP? I need more of that energy.',
     NULL, NULL, true,  NOW()-INTERVAL '58 days'),

    (gen_random_uuid(),'${CONVO(1)}','00000002-0000-0000-0000-000000000000',
     'Working on it 👀 3 new tracks almost ready. Stay tuned!',
     NULL, NULL, true,  NOW()-INTERVAL '57 days'),

    -- Sara shares Neon City track card
    (gen_random_uuid(),'${CONVO(1)}','00000008-0000-0000-0000-000000000000',
     'Also loving this one! 🔥',
     'track', 'c0000003-0000-0000-0000-000000000000', true, NOW()-INTERVAL '30 days'),

    (gen_random_uuid(),'${CONVO(1)}','00000002-0000-0000-0000-000000000000',
     'haha that''s literally from last month. You really did go through the whole catalogue 😂',
     NULL, NULL, false, NOW()-INTERVAL '1 day'),

    -- ── Convo 2: Nour ↔ Fatma ────────────────────────────
    (gen_random_uuid(),'${CONVO(2)}','00000010-0000-0000-0000-000000000000',
     'Nour your voice absolutely destroyed me on Echo Lane. I cried on the train 😭',
     NULL, NULL, true,  NOW()-INTERVAL '50 days'),

    (gen_random_uuid(),'${CONVO(2)}','00000003-0000-0000-0000-000000000000',
     'That honestly made my day ❤️ Writing it was cathartic for me too.',
     NULL, NULL, true,  NOW()-INTERVAL '49 days'),

    (gen_random_uuid(),'${CONVO(2)}','00000010-0000-0000-0000-000000000000',
     'Are you playing any live shows? I''d drive anywhere to see you.',
     NULL, NULL, true,  NOW()-INTERVAL '48 days'),

    (gen_random_uuid(),'${CONVO(2)}','00000003-0000-0000-0000-000000000000',
     'Planning something small in Alex next month! Will announce on my profile.',
     NULL, NULL, true,  NOW()-INTERVAL '47 days'),

    (gen_random_uuid(),'${CONVO(2)}','00000010-0000-0000-0000-000000000000',
     'Can''t wait!! Check out Morning Light if you haven''t —',
     'track', 'c0000007-0000-0000-0000-000000000000', true,  NOW()-INTERVAL '20 days'),

    (gen_random_uuid(),'${CONVO(2)}','00000003-0000-0000-0000-000000000000',
     'That''s literally my own track haha! But thank you 😂😂',
     NULL, NULL, false, NOW()-INTERVAL '5 days'),

    -- ── Convo 3: BeatMaker ↔ Mo ──────────────────────────
    (gen_random_uuid(),'${CONVO(3)}','00000009-0000-0000-0000-000000000000',
     'Bro Street Code is the hardest thing I heard this year 🔥🔥',
     NULL, NULL, true,  NOW()-INTERVAL '45 days'),

    (gen_random_uuid(),'${CONVO(3)}','00000004-0000-0000-0000-000000000000',
     'Appreciate that man! That 808 took me two days to get right lol',
     NULL, NULL, true,  NOW()-INTERVAL '44 days'),

    (gen_random_uuid(),'${CONVO(3)}','00000009-0000-0000-0000-000000000000',
     'Two days well spent. EP when?',
     NULL, NULL, true,  NOW()-INTERVAL '43 days'),

    (gen_random_uuid(),'${CONVO(3)}','00000004-0000-0000-0000-000000000000',
     'Targeting end of Q3. Got 7 tracks ready. Finding the right 5.',
     NULL, NULL, true,  NOW()-INTERVAL '42 days'),

    (gen_random_uuid(),'${CONVO(3)}','00000009-0000-0000-0000-000000000000',
     'You need to include this one no matter what →',
     'track', 'c0000008-0000-0000-0000-000000000000', true, NOW()-INTERVAL '10 days'),

    (gen_random_uuid(),'${CONVO(3)}','00000004-0000-0000-0000-000000000000',
     '100%. That''s the lead single 💀',
     NULL, NULL, false, NOW()-INTERVAL '3 days'),

    -- ── Convo 4: Layla ↔ Hana ────────────────────────────
    (gen_random_uuid(),'${CONVO(4)}','00000012-0000-0000-0000-000000000000',
     'Layla! Blue Hour is my 3am playlist. Every. Single. Night.',
     NULL, NULL, true,  NOW()-INTERVAL '40 days'),

    (gen_random_uuid(),'${CONVO(4)}','00000005-0000-0000-0000-000000000000',
     'That is genuinely the highest compliment. 3am is when it was written 🌙',
     NULL, NULL, true,  NOW()-INTERVAL '39 days'),

    (gen_random_uuid(),'${CONVO(4)}','00000012-0000-0000-0000-000000000000',
     'Do you take requests? I''d love to hear something in 5/4.',
     NULL, NULL, true,  NOW()-INTERVAL '38 days'),

    (gen_random_uuid(),'${CONVO(4)}','00000005-0000-0000-0000-000000000000',
     'Oh I love 5/4 — Velvet Smoke has a section. Check the bridge at 2:10.',
     'track', 'c0000012-0000-0000-0000-000000000000', false, NOW()-INTERVAL '10 days'),

    -- ── Convo 5: Sara ↔ Mo ───────────────────────────────
    (gen_random_uuid(),'${CONVO(5)}','00000008-0000-0000-0000-000000000000',
     'Mo did you hear Karim''s new upload? Neon City goes crazy.',
     NULL, NULL, true,  NOW()-INTERVAL '35 days'),

    (gen_random_uuid(),'${CONVO(5)}','00000009-0000-0000-0000-000000000000',
     'YES been playing it all day. The bassline in the second half 👌',
     NULL, NULL, true,  NOW()-INTERVAL '34 days'),

    (gen_random_uuid(),'${CONVO(5)}','00000008-0000-0000-0000-000000000000',
     'I added it to Late Night Electronic playlist. Check it out →',
     'playlist', 'e0000001-0000-0000-0000-000000000000', true, NOW()-INTERVAL '33 days'),

    (gen_random_uuid(),'${CONVO(5)}','00000009-0000-0000-0000-000000000000',
     'This playlist is 🔥 You have good taste Sara fr',
     NULL, NULL, false, NOW()-INTERVAL '2 days'),

    -- ── Convo 6: Karim ↔ Mo (collab inquiry) ─────────────
    (gen_random_uuid(),'${CONVO(6)}','00000009-0000-0000-0000-000000000000',
     'Karim man I''ve been following you for a while. Any chance we could collab?',
     NULL, NULL, true,  NOW()-INTERVAL '30 days'),

    (gen_random_uuid(),'${CONVO(6)}','00000002-0000-0000-0000-000000000000',
     'Always open to it! Send me some of your work — let''s see if the sounds vibe.',
     NULL, NULL, true,  NOW()-INTERVAL '29 days'),

    (gen_random_uuid(),'${CONVO(6)}','00000009-0000-0000-0000-000000000000',
     'Here''s my latest. More of a hip-hop feel but I think it could work →',
     'track', 'c0000009-0000-0000-0000-000000000000', true, NOW()-INTERVAL '28 days'),

    (gen_random_uuid(),'${CONVO(6)}','00000002-0000-0000-0000-000000000000',
     'This lo-fi energy is actually interesting. I could layer something on top. DM me your IG.',
     NULL, NULL, false, NOW()-INTERVAL '6 hours');
  `);

};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM messages WHERE conversation_id IN (
      '${CONVO(1)}','${CONVO(2)}','${CONVO(3)}',
      '${CONVO(4)}','${CONVO(5)}','${CONVO(6)}'
    );
  `);
  await db.runSql(`
    DELETE FROM conversations WHERE id IN (
      '${CONVO(1)}','${CONVO(2)}','${CONVO(3)}',
      '${CONVO(4)}','${CONVO(5)}','${CONVO(6)}'
    );
  `);
};

exports._meta = { version: 1 };