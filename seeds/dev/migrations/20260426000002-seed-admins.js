'use strict';

exports.setup = function () {};

// bcrypt hash of 'admin123!' rounds=10
// node -e "const b=require('bcryptjs');b.hash('admin123!',10).then(h=>console.log(h))"
const HASH = '$2a$10$ba6Rk1BZ4Yrh8HBxNSVQU.XRytpf9jJVU7s9Mnl/aLAF.gA8iFR16';

exports.up = async function (db) {
  await db.runSql(`
    INSERT INTO users (
      email, password_hashed, username, display_name,
      first_name, last_name, bio,
      role, is_verified, is_private,
      profile_picture, cover_photo,
      country, city,
      followers_count, following_count,
      created_at
    ) VALUES

    ('admin@rythmify.com', '${HASH}', 'platformadmin', 'Platform Admin',
     'Platform', 'Admin', 'Keeping the lights on at Rythmify.',
     'admin', true, false,
     'https://picsum.photos/seed/500/200/200',
     'https://picsum.photos/seed/600/1200/400',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '400 days'),

    ('moderator@rythmify.com', '${HASH}', 'contentmoderator', 'Content Moderator',
     'Content', 'Moderator', 'Ensuring Rythmify remains a safe and creative space.',
     'admin', true, false,
     'https://picsum.photos/seed/501/200/200',
     'https://picsum.photos/seed/601/1200/400',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '380 days'),

    ('support@rythmify.com', '${HASH}', 'supportagent', 'Support Agent',
     'Support', 'Agent', 'Here to help artists and listeners get the most out of Rythmify.',
     'admin', true, false,
     'https://picsum.photos/seed/502/200/200',
     'https://picsum.photos/seed/602/1200/400',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '360 days'),

    ('analytics@rythmify.com', '${HASH}', 'analyticsadmin', 'Analytics Admin',
     'Analytics', 'Admin', 'Turning streams into insights across the Rythmify platform.',
     'admin', true, false,
     'https://picsum.photos/seed/503/200/200',
     'https://picsum.photos/seed/603/1200/400',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '340 days'),

    ('devops@rythmify.com', '${HASH}', 'devopsadmin', 'DevOps Admin',
     'DevOps', 'Admin', 'Keeping Rythmify fast, reliable, and always on.',
     'admin', true, false,
     'https://picsum.photos/seed/504/200/200',
     'https://picsum.photos/seed/604/1200/400',
     'EG', 'Cairo', 0, 0, NOW() - INTERVAL '320 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM users WHERE email IN (
      'admin@rythmify.com', 'moderator@rythmify.com',
      'support@rythmify.com', 'analytics@rythmify.com',
      'devops@rythmify.com'
    );
  `);
};

exports._meta = { version: 1 };
