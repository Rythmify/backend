'use strict';

exports.setup = function () {};

// bcrypt hash of 'Password123!' rounds=10
const HASH = '$2a$10$WxXunTxTxq9TX0B1ykCDOO8GXxr9sukDDmtHnzoZAnu6LfroQH2w.';

exports.up = async function (db) {
  await db.runSql(`
    INSERT INTO users (
      email, password_hashed, username, display_name,
      first_name, last_name, bio,
      role, is_verified, is_private,
      profile_picture, cover_photo,
      country, city, gender, date_of_birth,
      followers_count, following_count, created_at
    ) VALUES

    -- ── Arabic listeners (verified: first 10) ────────────────

    ('ahmed.hassan@example.com', '${HASH}', 'ahmedhassan', 'Ahmed Hassan',
     'Ahmed', 'Hassan', 'Music lover from Cairo. Electronic and Arabic trap all day.',
     'listener', true, false,
     'https://picsum.photos/seed/1/200/200', 'https://picsum.photos/seed/51/1200/400',
     'EG', 'Cairo', 'male', '1994-03-15', 0, 0, NOW() - INTERVAL '300 days'),

    ('mohamed.ali@example.com', '${HASH}', 'mohamedali', 'Mohamed Ali',
     'Mohamed', 'Ali', 'Alexandria native. Indie rock and electronic music enthusiast.',
     'listener', true, false,
     'https://picsum.photos/seed/2/200/200', 'https://picsum.photos/seed/52/1200/400',
     'EG', 'Alexandria', 'male', '1997-08-22', 0, 0, NOW() - INTERVAL '290 days'),

    ('fatma.ibrahim@example.com', '${HASH}', 'fatmaibrahim', 'Fatma Ibrahim',
     'Fatma', 'Ibrahim', 'Indie pop and Arabic pop collector from Giza.',
     'listener', true, false,
     'https://picsum.photos/seed/3/200/200', 'https://picsum.photos/seed/53/1200/400',
     'EG', 'Giza', 'female', '1995-11-10', 0, 0, NOW() - INTERVAL '280 days'),

    ('omar.khalid@example.com', '${HASH}', 'omarkhalid', 'Omar Khalid',
     'Omar', 'Khalid', 'Hip-hop head and Arabic trap fan from Cairo.',
     'listener', true, false,
     'https://picsum.photos/seed/4/200/200', 'https://picsum.photos/seed/54/1200/400',
     'EG', 'Cairo', 'male', '2000-05-03', 0, 0, NOW() - INTERVAL '270 days'),

    ('nour.eldin@example.com', '${HASH}', 'noureldin', 'Nour El Din',
     'Nour', 'El Din', 'Discovering new music every day. Psychedelic rock is my religion.',
     'listener', true, false,
     'https://picsum.photos/seed/5/200/200', 'https://picsum.photos/seed/55/1200/400',
     'EG', 'Cairo', 'male', '1998-12-19', 0, 0, NOW() - INTERVAL '260 days'),

    ('layla.mostafa@example.com', '${HASH}', 'laylamostafa', 'Layla Mostafa',
     'Layla', 'Mostafa', 'R&B and soul listener from Alexandria. Music is my therapy.',
     'listener', true, false,
     'https://picsum.photos/seed/6/200/200', 'https://picsum.photos/seed/56/1200/400',
     'EG', 'Alexandria', 'female', '1999-07-08', 0, 0, NOW() - INTERVAL '250 days'),

    ('karim.youssef@example.com', '${HASH}', 'karimyoussef', 'Karim Youssef',
     'Karim', 'Youssef', 'Alternative rock and Arabic rock enthusiast from Cairo.',
     'listener', true, false,
     'https://picsum.photos/seed/7/200/200', 'https://picsum.photos/seed/57/1200/400',
     'EG', 'Cairo', 'male', '1996-02-25', 0, 0, NOW() - INTERVAL '240 days'),

    ('sara.ahmed@example.com', '${HASH}', 'saraahmed', 'Sara Ahmed',
     'Sara', 'Ahmed', 'Pop and indie pop listener from Giza. Always discovering new artists.',
     'listener', true, false,
     'https://picsum.photos/seed/8/200/200', 'https://picsum.photos/seed/58/1200/400',
     'EG', 'Giza', 'female', '2001-09-14', 0, 0, NOW() - INTERVAL '230 days'),

    ('mahmoud.hassan@example.com', '${HASH}', 'mahmoudhassan', 'Mahmoud Hassan',
     'Mahmoud', 'Hassan', 'Cairo-based music enthusiast. From Amr Diab to Kendrick Lamar.',
     'listener', true, false,
     'https://picsum.photos/seed/9/200/200', 'https://picsum.photos/seed/59/1200/400',
     'EG', 'Cairo', 'male', '1993-04-30', 0, 0, NOW() - INTERVAL '220 days'),

    ('rana.tarek@example.com', '${HASH}', 'ranatarek', 'Rana Tarek',
     'Rana', 'Tarek', 'Beirut-based listener with eclectic taste across genres.',
     'listener', true, false,
     'https://picsum.photos/seed/10/200/200', 'https://picsum.photos/seed/60/1200/400',
     'LB', 'Beirut', 'female', '2000-01-17', 0, 0, NOW() - INTERVAL '210 days'),

    -- ── Arabic listeners (not verified) ──────────────────────

    ('youssef.samir@example.com', '${HASH}', 'youssefsamir', 'Youssef Samir',
     'Youssef', 'Samir', 'Hip-hop and trap listener from Cairo.',
     'listener', false, false,
     'https://picsum.photos/seed/11/200/200', 'https://picsum.photos/seed/61/1200/400',
     'EG', 'Cairo', 'male', '2002-06-28', 0, 0, NOW() - INTERVAL '200 days'),

    ('hana.mohamed@example.com', '${HASH}', 'hanamohamed', 'Hana Mohamed',
     'Hana', 'Mohamed', 'Indie and alternative listener from Mansoura.',
     'listener', false, false,
     'https://picsum.photos/seed/12/200/200', 'https://picsum.photos/seed/62/1200/400',
     'EG', 'Mansoura', 'female', '1999-11-05', 0, 0, NOW() - INTERVAL '190 days'),

    ('khaled.nasser@example.com', '${HASH}', 'khalednasser', 'Khaled Nasser',
     'Khaled', 'Nasser', 'R&B and soul fan from Riyadh with international taste.',
     'listener', false, false,
     'https://picsum.photos/seed/13/200/200', 'https://picsum.photos/seed/63/1200/400',
     'SA', 'Riyadh', 'male', '1997-08-14', 0, 0, NOW() - INTERVAL '180 days'),

    ('dina.kamal@example.com', '${HASH}', 'dinakamal', 'Dina Kamal',
     'Dina', 'Kamal', 'Pop and electronic listener from Cairo.',
     'listener', false, false,
     'https://picsum.photos/seed/14/200/200', 'https://picsum.photos/seed/64/1200/400',
     'EG', 'Cairo', 'female', '2003-03-21', 0, 0, NOW() - INTERVAL '170 days'),

    ('amira.sayed@example.com', '${HASH}', 'amirasayed', 'Amira Sayed',
     'Amira', 'Sayed', 'Eclectic listener from Amman who loves discovering new sounds.',
     'listener', false, false,
     'https://picsum.photos/seed/15/200/200', 'https://picsum.photos/seed/65/1200/400',
     'JO', 'Amman', 'female', '1995-07-09', 0, 0, NOW() - INTERVAL '160 days'),

    -- ── Western listeners ─────────────────────────────────────

    ('james.wilson@example.com', '${HASH}', 'jameswilson', 'James Wilson',
     'James', 'Wilson', 'New York music lover. Indie rock and alternative are my world.',
     'listener', false, false,
     'https://picsum.photos/seed/16/200/200', 'https://picsum.photos/seed/66/1200/400',
     'US', 'New York', 'male', '1992-11-12', 0, 0, NOW() - INTERVAL '155 days'),

    ('emma.thompson@example.com', '${HASH}', 'emmathompson', 'Emma Thompson',
     'Emma', 'Thompson', 'Manchester-based fan of everything from Radiohead to pop.',
     'listener', false, false,
     'https://picsum.photos/seed/17/200/200', 'https://picsum.photos/seed/67/1200/400',
     'GB', 'Manchester', 'female', '1996-05-23', 0, 0, NOW() - INTERVAL '150 days'),

    ('lucas.garcia@example.com', '${HASH}', 'lucasgarcia', 'Lucas Garcia',
     'Lucas', 'Garcia', 'Electronic and indie pop enthusiast from Madrid.',
     'listener', false, false,
     'https://picsum.photos/seed/18/200/200', 'https://picsum.photos/seed/68/1200/400',
     'ES', 'Madrid', 'male', '1998-09-17', 0, 0, NOW() - INTERVAL '145 days'),

    ('sofia.martinez@example.com', '${HASH}', 'sofiamartinez', 'Sofia Martinez',
     'Sofia', 'Martinez', 'Pop and R&B lover from Mexico City.',
     'listener', false, false,
     'https://picsum.photos/seed/19/200/200', 'https://picsum.photos/seed/69/1200/400',
     'MX', 'Mexico City', 'female', '2000-02-14', 0, 0, NOW() - INTERVAL '140 days'),

    ('noah.johnson@example.com', '${HASH}', 'noahjohnson', 'Noah Johnson',
     'Noah', 'Johnson', 'Hip-hop and alternative rock fan from Los Angeles.',
     'listener', false, false,
     'https://picsum.photos/seed/20/200/200', 'https://picsum.photos/seed/70/1200/400',
     'US', 'Los Angeles', 'male', '1995-08-31', 0, 0, NOW() - INTERVAL '135 days'),

    ('olivia.davis@example.com', '${HASH}', 'oliviadavis', 'Olivia Davis',
     'Olivia', 'Davis', 'Indie pop and psychedelic rock fan from Sydney.',
     'listener', false, false,
     'https://picsum.photos/seed/21/200/200', 'https://picsum.photos/seed/71/1200/400',
     'AU', 'Sydney', 'female', '1997-12-03', 0, 0, NOW() - INTERVAL '130 days'),

    ('ethan.brown@example.com', '${HASH}', 'ethanbrown', 'Ethan Brown',
     'Ethan', 'Brown', 'Chicago music head. Hip-hop and R&B are my life.',
     'listener', false, false,
     'https://picsum.photos/seed/22/200/200', 'https://picsum.photos/seed/72/1200/400',
     'US', 'Chicago', 'male', '1994-04-19', 0, 0, NOW() - INTERVAL '125 days'),

    ('isabella.taylor@example.com', '${HASH}', 'isabellataylor', 'Isabella Taylor',
     'Isabella', 'Taylor', 'Toronto listener who loves everything from Drake to Frank Ocean.',
     'listener', false, false,
     'https://picsum.photos/seed/23/200/200', 'https://picsum.photos/seed/73/1200/400',
     'CA', 'Toronto', 'female', '2001-07-26', 0, 0, NOW() - INTERVAL '120 days'),

    ('mason.anderson@example.com', '${HASH}', 'masonanderson', 'Mason Anderson',
     'Mason', 'Anderson', 'Seattle listener with a love for alternative and psychedelic music.',
     'listener', false, false,
     'https://picsum.photos/seed/24/200/200', 'https://picsum.photos/seed/74/1200/400',
     'US', 'Seattle', 'male', '1993-10-08', 0, 0, NOW() - INTERVAL '115 days'),

    ('ava.thomas@example.com', '${HASH}', 'avathomas', 'Ava Thomas',
     'Ava', 'Thomas', 'London-based listener who curates playlists for every mood.',
     'listener', false, false,
     'https://picsum.photos/seed/25/200/200', 'https://picsum.photos/seed/75/1200/400',
     'GB', 'London', 'female', '1999-03-15', 0, 0, NOW() - INTERVAL '110 days'),

    ('logan.jackson@example.com', '${HASH}', 'loganjackson', 'Logan Jackson',
     'Logan', 'Jackson', 'Houston listener. Hip-hop from the streets to the stage.',
     'listener', false, false,
     'https://picsum.photos/seed/26/200/200', 'https://picsum.photos/seed/76/1200/400',
     'US', 'Houston', 'male', '1996-01-22', 0, 0, NOW() - INTERVAL '105 days'),

    ('charlotte.white@example.com', '${HASH}', 'charlottewhite', 'Charlotte White',
     'Charlotte', 'White', 'Pop and indie listener from Auckland. Always looking for new gems.',
     'listener', false, false,
     'https://picsum.photos/seed/27/200/200', 'https://picsum.photos/seed/77/1200/400',
     'NZ', 'Auckland', 'female', '2002-08-07', 0, 0, NOW() - INTERVAL '100 days'),

    ('oliver.harris@example.com', '${HASH}', 'oliverharris', 'Oliver Harris',
     'Oliver', 'Harris', 'Birmingham-based listener with decades of music knowledge.',
     'listener', false, false,
     'https://picsum.photos/seed/28/200/200', 'https://picsum.photos/seed/78/1200/400',
     'GB', 'Birmingham', 'male', '1990-12-30', 0, 0, NOW() - INTERVAL '95 days'),

    ('mia.martin@example.com', '${HASH}', 'miamartin', 'Mia Martin',
     'Mia', 'Martin', 'Paris-based electronic and pop enthusiast.',
     'listener', false, false,
     'https://picsum.photos/seed/29/200/200', 'https://picsum.photos/seed/79/1200/400',
     'FR', 'Paris', 'female', '1998-06-18', 0, 0, NOW() - INTERVAL '90 days'),

    ('liam.thompson@example.com', '${HASH}', 'liamthompson', 'Liam Thompson',
     'Liam', 'Thompson', 'Dublin listener. Indie rock and alternative are always on.',
     'listener', false, false,
     'https://picsum.photos/seed/30/200/200', 'https://picsum.photos/seed/80/1200/400',
     'IE', 'Dublin', 'male', '1995-11-04', 0, 0, NOW() - INTERVAL '85 days');
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    DELETE FROM users WHERE email LIKE '%@example.com' AND role = 'listener';
  `);
};

exports._meta = { version: 1 };
