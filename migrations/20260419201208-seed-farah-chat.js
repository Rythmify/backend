'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // Get both users
  const farahResult = await db.runSql(
    `SELECT id FROM users WHERE email = 'Farah.hassan05@eng-st.cu.edu.eg' LIMIT 1`
  );
  const nourResult = await db.runSql(
    `SELECT id FROM users WHERE email = 'nour_sound@rythmify.com' LIMIT 1`
  );

  const farah = farahResult.rows[0];
  const nour = nourResult.rows[0];

  if (!farah || !nour) {
    console.warn('⚠️  One or both users not found — skipping seed.');
    console.warn('   farah:', farah ? farah.id : 'NOT FOUND');
    console.warn('   nour:', nour ? nour.id : 'NOT FOUND');
    return;
  }

  // conversations table requires user_a_id < user_b_id (ordered pair constraint)
  const userAId = farah.id < nour.id ? farah.id : nour.id;
  const userBId = farah.id < nour.id ? nour.id : farah.id;

  // Create conversation
  const convResult = await db.runSql(
    `INSERT INTO conversations (user_a_id, user_b_id)
     VALUES ($1, $2)
     ON CONFLICT ON CONSTRAINT conversations_ordered_pair DO UPDATE
       SET last_message_at = now()
     RETURNING id`,
    [userAId, userBId]
  );

  const conversationId = convResult.rows[0].id;

  // Insert message — sender is farah
  await db.runSql(
    `INSERT INTO messages (conversation_id, sender_id, content)
     VALUES ($1, $2, 'hi')`,
    [conversationId, farah.id]
  );

  console.log('✅ Conversation and message seeded successfully.');
  console.log('   conversation_id:', conversationId);
};

exports.down = async function (db) {
  // Find both users
  const farahResult = await db.runSql(
    `SELECT id FROM users WHERE email = 'Farah.hassan05@eng-st.cu.edu.eg' LIMIT 1`
  );
  const nourResult = await db.runSql(
    `SELECT id FROM users WHERE email = 'nour_sound@rythmify.com' LIMIT 1`
  );

  const farah = farahResult.rows[0];
  const nour = nourResult.rows[0];

  if (!farah || !nour) return;

  const userAId = farah.id < nour.id ? farah.id : nour.id;
  const userBId = farah.id < nour.id ? nour.id : farah.id;

  // Messages are deleted via CASCADE when conversation is deleted
  await db.runSql(
    `DELETE FROM conversations WHERE user_a_id = $1 AND user_b_id = $2`,
    [userAId, userBId]
  );

  console.log('✅ Seed conversation removed.');
};

exports._meta = {
  version: 1,
};