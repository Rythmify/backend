'use strict';

let dbm;
let type;
let seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  // conversations table
  await db.runSql(`
    CREATE TABLE "conversations" (
      "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_a_id"       uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "user_b_id"       uuid        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
      "created_at"      timestamptz NOT NULL DEFAULT now(),
      "last_message_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_by_a"    boolean     NOT NULL DEFAULT false,
      "deleted_by_b"    boolean     NOT NULL DEFAULT false,

      CONSTRAINT "conversations_ordered_pair"
        CHECK (user_a_id < user_b_id),

      CONSTRAINT "conversations_no_self_chat"
        CHECK (user_a_id <> user_b_id)
    );
  `);

  // messages table
  await db.runSql(`
    CREATE TABLE "messages" (
      "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      "conversation_id" uuid        NOT NULL REFERENCES "conversations" ("id") ON DELETE CASCADE,
      "sender_id"       uuid        NOT NULL REFERENCES "users"         ("id") ON DELETE CASCADE,
      "content"         text,
      "embed_type"      embed_type,
      "embed_id"        uuid,
      "is_read"         boolean     NOT NULL DEFAULT false,
      "created_at"      timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT "messages_has_content_or_embed"
        CHECK (content IS NOT NULL OR embed_id IS NOT NULL)
    );
  `);

  // Indexes
  await db.runSql(`CREATE UNIQUE INDEX ON "conversations" ("user_a_id", "user_b_id");`);
  await db.runSql(`CREATE INDEX ON "conversations" ("user_a_id");`);
  await db.runSql(`CREATE INDEX ON "conversations" ("user_b_id");`);
  await db.runSql(`CREATE INDEX ON "messages" ("conversation_id");`);
  await db.runSql(`CREATE INDEX ON "messages" ("sender_id");`);
  await db.runSql(`CREATE INDEX ON "messages" ("created_at");`);

  // Triggers

  // Update last_message_at on every new message
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_messages_last_message_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE conversations
      SET last_message_at = now()
      WHERE id = NEW.conversation_id;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_conversation_last_message_at
      AFTER INSERT ON "messages"
      FOR EACH ROW EXECUTE FUNCTION trg_messages_last_message_at();
  `);

  // Validate sender is a participant in the conversation
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_messages_validate_sender()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      conv conversations%ROWTYPE;
    BEGIN
      SELECT * INTO conv FROM conversations WHERE id = NEW.conversation_id;
      IF conv.id IS NULL THEN
        RAISE EXCEPTION 'Conversation % does not exist', NEW.conversation_id;
      END IF;
      IF NEW.sender_id <> conv.user_a_id AND NEW.sender_id <> conv.user_b_id THEN
        RAISE EXCEPTION
          'sender_id % is not a participant of conversation %',
          NEW.sender_id, NEW.conversation_id;
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_messages_sender_check
      BEFORE INSERT ON "messages"
      FOR EACH ROW EXECUTE FUNCTION trg_messages_validate_sender();
  `);

  // Purge conversation and messages when both users soft-delete
  await db.runSql(`
    CREATE OR REPLACE FUNCTION trg_conversations_purge_both_deleted()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.deleted_by_a = true AND NEW.deleted_by_b = true THEN
        DELETE FROM messages      WHERE conversation_id = NEW.id;
        DELETE FROM conversations WHERE id = NEW.id;
      END IF;
      RETURN NULL;
    END;
    $$;
  `);
  await db.runSql(`
    CREATE TRIGGER trg_conversation_purge_on_both_deleted
      AFTER UPDATE OF deleted_by_a, deleted_by_b ON "conversations"
      FOR EACH ROW EXECUTE FUNCTION trg_conversations_purge_both_deleted();
  `);
};

exports.down = async function (db) {
  await db.runSql(
    `DROP TRIGGER IF EXISTS trg_conversation_purge_on_both_deleted ON "conversations";`
  );
  await db.runSql(`DROP TRIGGER IF EXISTS trg_messages_sender_check              ON "messages";`);
  await db.runSql(`DROP TRIGGER IF EXISTS trg_conversation_last_message_at       ON "messages";`);

  await db.runSql(`DROP FUNCTION IF EXISTS trg_conversations_purge_both_deleted();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_messages_validate_sender();`);
  await db.runSql(`DROP FUNCTION IF EXISTS trg_messages_last_message_at();`);

  await db.runSql(`DROP TABLE IF EXISTS "messages"      CASCADE;`);
  await db.runSql(`DROP TABLE IF EXISTS "conversations" CASCADE;`);
};

exports._meta = {
  version: 1,
};
