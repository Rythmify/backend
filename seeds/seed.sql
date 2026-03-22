BEGIN;


-- 1. GENRES (10) 

INSERT INTO genres (id, name) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Quran Recitation'),
  ('a1000000-0000-0000-0000-000000000002', 'Islamic Lecture'),
  ('a1000000-0000-0000-0000-000000000003', 'Personal Development'),
  ('a1000000-0000-0000-0000-000000000004', 'Business & Entrepreneurship'),
  ('a1000000-0000-0000-0000-000000000005', 'Sports & Fitness'),
  ('a1000000-0000-0000-0000-000000000006', 'Mental Health & Wellness'),
  ('a1000000-0000-0000-0000-000000000007', 'Science & Technology'),
  ('a1000000-0000-0000-0000-000000000008', 'True Crime & Society'),
  ('a1000000-0000-0000-0000-000000000009', 'Daily 5-Minute Talks'),
  ('a1000000-0000-0000-0000-000000000010', 'Motivation & Reminders');


-- 2. TAGS (10)

INSERT INTO tags (id, name) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'quran'),
  ('b1000000-0000-0000-0000-000000000002', 'short'),
  ('b1000000-0000-0000-0000-000000000003', 'english'),
  ('b1000000-0000-0000-0000-000000000004', 'arabic'),
  ('b1000000-0000-0000-0000-000000000005', 'interview'),
  ('b1000000-0000-0000-0000-000000000006', 'solo'),
  ('b1000000-0000-0000-0000-000000000007', 'beginner-friendly'),
  ('b1000000-0000-0000-0000-000000000008', 'deep-dive'),
  ('b1000000-0000-0000-0000-000000000009', 'daily-habit'),
  ('b1000000-0000-0000-0000-000000000010', 'ramadan');


-- 3. USERS
--    1 admin + 8 creators (role=artist) + 6 listeners
INSERT INTO users (id, email, password_hashed, username, display_name, gender, date_of_birth, role, is_verified, country) VALUES

  -- Admin
  ('c0000000-0000-0000-0000-000000000001',
   'admin@rythmify.com',
   '$2b$12$u0Wvmh6ELlK6w1sNnNTpF.Zs13MRVs2PcymGR5kse61CW0HuaX7Qa',
   'admin', 'Rythmify Admin',
   'male', '1990-01-01', 'admin', true, 'EG'),
 -- Creators
  ('c1000000-0000-0000-0000-000000000001',
   'basel_mones@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'basel_mones', 'Basel Mones',
   'male', '1975-03-10', 'artist', true, 'EG'),

  ('c1000000-0000-0000-0000-000000000002',
   'ustadh_omar@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'ustadh_omar', 'Ustadh Omar',
   'male', '1980-07-22', 'artist', true, 'SA'),

  ('c1000000-0000-0000-0000-000000000003',
   'sister_maryam@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'sister_maryam', 'Sister Maryam',
   'female', '1988-11-05', 'artist', true, 'GB'),

  ('c1000000-0000-0000-0000-000000000004',
   'dr_khalid_tafsir@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'dr_khalid_tafsir', 'Dr. Khalid Tafsir',
   'male', '1970-09-28', 'artist', true, 'JO'),

  ('c1000000-0000-0000-0000-000000000005',
   'layla_mindset@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'layla_mindset', 'Layla Mindset',
   'female', '1992-04-14', 'artist', true, 'AE'),

  ('c1000000-0000-0000-0000-000000000006',
   'coach_karim@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'coach_karim', 'Coach Karim',
   'male', '1985-08-19', 'artist', true, 'MA'),

  ('c1000000-0000-0000-0000-000000000007',
   'sara_builds@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'sara_builds', 'Sara Builds',
   'female', '1995-01-30', 'artist', true, 'US'),

  ('c1000000-0000-0000-0000-000000000008',
   'tariq_talks@example.com',
   '$2b$12$NvCh9JzVbUdzAKHmoPpcSu0.LAcnUE3gEL8pTShDMoIEdkIEsY..i',
   'tariq_talks', 'Tariq Talks',
   'male', '1990-06-05', 'artist', true, 'CA'),

  -- === LISTENERS ===
  ('c2000000-0000-0000-0000-000000000001',
   'listener1@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'ali_hassan', 'Ali Hassan',
   'male', '2000-04-18', 'listener', true, 'EG'),

  ('c2000000-0000-0000-0000-000000000002',
   'listener2@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'sara_mostafa', 'Sara Mostafa',
   'female', '2001-08-25', 'listener', true, 'EG'),

  ('c2000000-0000-0000-0000-000000000003',
   'listener3@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'jake_w', 'Jake Williams',
   'male', '1998-12-03', 'listener', true, 'CA'),

  ('c2000000-0000-0000-0000-000000000004',
   'listener4@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'mia_d', 'Mia Dupont',
   'female', '2003-01-17', 'listener', true, 'FR'),

  ('c2000000-0000-0000-0000-000000000005',
   'listener5@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'omar_alfarsi', 'Omar Al-Farsi',
   'male', '1997-05-30', 'listener', true, 'SA'),

  ('c2000000-0000-0000-0000-000000000006',
   'listener6@example.com',
   '$2b$12$XQCpHZK73KCarZeh4HOVb.LDcbNROfUN3Tk4sQuU8oqjXJ6gq3jMK',
   'nour_k', 'Nour Khalil',
   'female', '1999-09-09', 'listener', true, 'LB');


-- 4. FOLLOWS
--    trg_follow_counts trigger handles counter updates

INSERT INTO follows (follower_id, following_id) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006'),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005'),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000007'),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000008'),
  ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002'),
  ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005'),
  ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004'),
  ('c2000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000008'),
  ('c1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000007'),
  ('c1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000008'),
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');


-- 5. TRACKS (16 total — 8 Islamic, 8 general)

INSERT INTO tracks
  (id, title, description, genre_id, cover_image, waveform_url, audio_url,
   duration, status, is_public, user_id, play_count, like_count, explicit_content)
VALUES

  ('d1000000-0000-0000-0000-000000000001',
   'Surah Al-Mudassir — Basel Mones',
   'Recitation of Surah Al-Mudassir (74) by Basel Mones',
   'a1000000-0000-0000-0000-000000000001',
   'covers/basel-mones/surah-elmudsar.jpg',
   'waveforms/basel-mones/Surah_Elmudsar.json',
   'audio/basel-mones/Surah_Elmudsar.mp3',
   NULL, 'ready', true,
   'c1000000-0000-0000-0000-000000000001', 12400, 980, false),

  ('d1000000-0000-0000-0000-000000000002',
   'Surah Al-Muzzammil — Basel Mones',
   'Recitation of Surah Al-Muzzammil (73) by Basel Mones',
   'a1000000-0000-0000-0000-000000000001',
   'covers/basel-mones/surah-elmuzamel.jpg',
   'waveforms/basel-mones/Surah_Elmuzamel.json',
   'audio/basel-mones/Surah_Elmuzamel.mp3',
   NULL, 'ready', true,
   'c1000000-0000-0000-0000-000000000001', 8700, 640, false),

 
  ('d1000000-0000-0000-0000-000000000003',
   'The Importance of Salah',
   'A concise lecture on why prayer is the pillar of Islam',
   'a1000000-0000-0000-0000-000000000002',
   'covers/ustadh-omar/importance-of-salah.jpg',
   'waveforms/ustadh-omar/importance-of-salah.json',
   'audio/ustadh-omar/importance-of-salah.mp3',
   1845, 'ready', false,
   'c1000000-0000-0000-0000-000000000002', 5600, 310, false),

  ('d1000000-0000-0000-0000-000000000004',
   '5 Minutes: Why Gratitude Changes Everything',
   'A short Islamic reminder on the power of shukr',
   'a1000000-0000-0000-0000-000000000009',
   'covers/ustadh-omar/gratitude-5min.jpg',
   'waveforms/ustadh-omar/gratitude-5min.json',
   'audio/ustadh-omar/gratitude-5min.mp3',
   310, 'ready', true,
   'c1000000-0000-0000-0000-000000000002', 3200, 210, false),


  ('d1000000-0000-0000-0000-000000000005',
   'Muslim Women in the Modern World — Ep. 1',
   'Faith, identity and confidence as a Muslim woman today',
   'a1000000-0000-0000-0000-000000000002',
   'covers/sister-maryam/ep1-cover.jpg',
   'waveforms/sister-maryam/ep1.json',
   'audio/sister-maryam/ep1-modern-world.mp3',
   2700, 'ready', true,
   'c1000000-0000-0000-0000-000000000003', 4100, 220, false),

  ('d1000000-0000-0000-0000-000000000006',
   'Balance: Deen, Career & Mental Health',
   'Honest conversation about juggling it all as a Muslim professional',
   'a1000000-0000-0000-0000-000000000006',
   'covers/sister-maryam/ep2-balance.jpg',
   'waveforms/sister-maryam/ep2-balance.json',
   'audio/sister-maryam/ep2-balance.mp3',
   3120, 'ready', true,
   'c1000000-0000-0000-0000-000000000003', 2800, 185, false),

 
  ('d1000000-0000-0000-0000-000000000007',
   'Tafsir Surah Al-Baqarah — Part 1',
   'Detailed explanation of the first 10 verses',
   'a1000000-0000-0000-0000-000000000002',
   'covers/dr-khalid/tafsir-baqarah-p1.jpg',
   'waveforms/dr-khalid/tafsir-baqarah-p1.json',
   'audio/dr-khalid/tafsir-baqarah-part1.mp3',
   3600, 'ready', true,
   'c1000000-0000-0000-0000-000000000004', 2100, 140, false),

  ('d1000000-0000-0000-0000-000000000008',
   '5 Minutes: The Story of Musa & Perseverance',
   'Quick reminder drawn from the story of Prophet Musa',
   'a1000000-0000-0000-0000-000000000009',
   'covers/dr-khalid/musa-5min.jpg',
   'waveforms/dr-khalid/musa-5min.json',
   'audio/dr-khalid/musa-5min.mp3',
   295, 'ready', true,
   'c1000000-0000-0000-0000-000000000004', 1750, 110, false),


  ('d1000000-0000-0000-0000-000000000009',
   'Stop Waiting to Feel Ready',
   'Why action comes before motivation, not after',
   'a1000000-0000-0000-0000-000000000003',
   'covers/layla-mindset/feel-ready.jpg',
   'waveforms/layla-mindset/feel-ready.json',
   'audio/layla-mindset/stop-waiting-to-feel-ready.mp3',
   1620, 'ready', true,
   'c1000000-0000-0000-0000-000000000005', 6300, 420, false),

  ('d1000000-0000-0000-0000-000000000010',
   '5 Minutes: One Habit That Will Change Your Morning',
   'A quick daily challenge to start your day with intention',
   'a1000000-0000-0000-0000-000000000009',
   'covers/layla-mindset/morning-habit.jpg',
   'waveforms/layla-mindset/morning-habit.json',
   'audio/layla-mindset/morning-habit-5min.mp3',
   305, 'ready', true,
   'c1000000-0000-0000-0000-000000000005', 9100, 710, false),

 
  ('d1000000-0000-0000-0000-000000000011',
   'How to Build Discipline Like an Athlete',
   'Lessons from high-performance sport that anyone can apply',
   'a1000000-0000-0000-0000-000000000005',
   'covers/coach-karim/discipline-athlete.jpg',
   'waveforms/coach-karim/discipline-athlete.json',
   'audio/coach-karim/discipline-like-athlete.mp3',
   2250, 'ready', true,
   'c1000000-0000-0000-0000-000000000006', 4800, 330, false),

  ('d1000000-0000-0000-0000-000000000012',
   'Ramadan Training: Stay Fit While Fasting',
   'Practical guide to maintaining your fitness during Ramadan',
   'a1000000-0000-0000-0000-000000000005',
   'covers/coach-karim/ramadan-training.jpg',
   'waveforms/coach-karim/ramadan-training.json',
   'audio/coach-karim/ramadan-training.mp3',
   1980, 'ready', true,
   'c1000000-0000-0000-0000-000000000006', 3500, 260, false),


  ('d1000000-0000-0000-0000-000000000013',
   'From 0 to First Client: My Story',
   'How I landed my first paying client with zero following',
   'a1000000-0000-0000-0000-000000000004',
   'covers/sara-builds/first-client.jpg',
   'waveforms/sara-builds/first-client.json',
   'audio/sara-builds/from-0-to-first-client.mp3',
   2880, 'ready', true,
   'c1000000-0000-0000-0000-000000000007', 5100, 370, false),

  ('d1000000-0000-0000-0000-000000000014',
   '5 Minutes: The One Email That Grows Your Business',
   'A quick actionable tip on email marketing for solopreneurs',
   'a1000000-0000-0000-0000-000000000009',
   'covers/sara-builds/email-tip.jpg',
   'waveforms/sara-builds/email-tip.json',
   'audio/sara-builds/email-grows-business-5min.mp3',
   298, 'ready', true,
   'c1000000-0000-0000-0000-000000000007', 4200, 295, false),


  ('d1000000-0000-0000-0000-000000000015',
   'Why Gen Z Is Burning Out at 22',
   'An honest look at hustle culture and its mental health toll',
   'a1000000-0000-0000-0000-000000000006',
   'covers/tariq-talks/burnout-genz.jpg',
   'waveforms/tariq-talks/burnout-genz.json',
   'audio/tariq-talks/genz-burnout.mp3',
   3060, 'ready', true,
   'c1000000-0000-0000-0000-000000000008', 7200, 540, false),

  ('d1000000-0000-0000-0000-000000000016',
   'The Social Media Detox Experiment',
   'I quit all social media for 30 days — here is what happened',
   'a1000000-0000-0000-0000-000000000003',
   'covers/tariq-talks/social-detox.jpg',
   'waveforms/tariq-talks/social-detox.json',
   'audio/tariq-talks/social-media-detox.mp3',
   2640, 'ready', true,
   'c1000000-0000-0000-0000-000000000008', 5800, 430, false);


-- 6. TRACK TAGS

INSERT INTO track_tags (track_id, tag_id) VALUES

  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'), -- quran
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002'), -- short
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001'), -- quran
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004'), -- arabic
  ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003'), -- english
  ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006'), -- solo
  ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002'), -- short
  ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000009'), -- daily-habit
  ('d1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003'), -- english
  ('d1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005'), -- interview
  ('d1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000003'), -- english
  ('d1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000008'), -- deep-dive
  ('d1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000004'), -- arabic
  ('d1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000002'), -- short
  ('d1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000010'), -- ramadan
  ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000003'), -- english
  ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000006'), -- solo
  ('d1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000002'), -- short
  ('d1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000009'), -- daily-habit
  ('d1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000006'), -- solo
  ('d1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000007'), -- beginner-friendly
  ('d1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000010'), -- ramadan
  ('d1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000007'), -- beginner-friendly
  ('d1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000006'), -- solo
  ('d1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000008'), -- deep-dive
  ('d1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000002'), -- short
  ('d1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000009'), -- daily-habit
  ('d1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000008'), -- deep-dive
  ('d1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000003'), -- english
  ('d1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000005'), -- interview
  ('d1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000003'); -- english


-- 7. TRACK ARTISTS (owner at position 1 for every track)

INSERT INTO track_artists (track_id, artist_id, position) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 1),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 1),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 1),
  ('d1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 1),
  ('d1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 1),
  ('d1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000004', 1),
  ('d1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000004', 1),
  ('d1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000005', 1),
  ('d1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000005', 1),
  ('d1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000006', 1),
  ('d1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000006', 1),
  ('d1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000007', 1),
  ('d1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000007', 1),
  ('d1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000008', 1),
  ('d1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000008', 1);

-- 8. ALBUMS / SERIES (4)

INSERT INTO albums (id, title, description, artist_id, genre_id, cover_image, is_public, release_date, track_count) VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'Basel Mones — Quran Collection',
   'Selected surahs with clear tajweed',
   'c1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'covers/albums/basel-mones-quran-collection.jpg',
   true, '2024-03-01', 2),

  ('e1000000-0000-0000-0000-000000000002',
   'Ustadh Omar — 5-Minute Series',
   'Quick Islamic reminders for busy people',
   'c1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000009',
   'covers/albums/ustadh-omar-5min.jpg',
   true, '2024-06-01', 2),

  ('e1000000-0000-0000-0000-000000000003',
   'Layla Mindset — Morning Series',
   'Short and long episodes to start your day right',
   'c1000000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000003',
   'covers/albums/layla-morning-series.jpg',
   true, '2024-08-15', 2),

  ('e1000000-0000-0000-0000-000000000004',
   'Tariq Talks — Society & Life',
   'Conversations about the things that matter',
   'c1000000-0000-0000-0000-000000000008',
   'a1000000-0000-0000-0000-000000000006',
   'covers/albums/tariq-talks-society.jpg',
   true, '2024-10-01', 2);


-- 9. ALBUM TRACKS

INSERT INTO album_tracks (album_id, track_id, position) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 1),
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 2),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 1),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000008', 2),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000010', 1),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000009', 2),
  ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000015', 1),
  ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000016', 2);


-- 10. PLAYLISTS (5 — mixed themed playlists)

INSERT INTO playlists (id, name, description, user_id, type, is_public, track_count) VALUES
  ('f1000000-0000-0000-0000-000000000001',
   'My Morning Routine',
   'A mix of reminders and motivation to start the day',
   'c2000000-0000-0000-0000-000000000001',
   'regular', true, 3),

  ('f1000000-0000-0000-0000-000000000002',
   'Ramadan Vibes',
   'Lectures, recitations and reminders for Ramadan',
   'c2000000-0000-0000-0000-000000000002',
   'regular', true, 3),

  ('f1000000-0000-0000-0000-000000000003',
   'Grind & Grow',
   'Business and personal dev episodes for the hustle',
   'c2000000-0000-0000-0000-000000000003',
   'regular', true, 3),

  ('f1000000-0000-0000-0000-000000000004',
   'Mental Reset',
   'Episodes for when you need to decompress and reflect',
   'c2000000-0000-0000-0000-000000000004',
   'regular', true, 3),

  ('f1000000-0000-0000-0000-000000000005',
   '5-Minute Daily',
   'Only short episodes — all under 6 minutes',
   'c2000000-0000-0000-0000-000000000005',
   'regular', true, 4);


-- 11. PLAYLIST TRACKS

INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', 1),
  ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010', 2),
  ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000009', 3),

  ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 1),
  ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', 2),
  ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000012', 3),

  ('f1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000013', 1),
  ('f1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000014', 2),
  ('f1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000011', 3),
 
  ('f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000015', 1),
  ('f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000006', 2),
  ('f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000016', 3),
 
  ('f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004', 1),
  ('f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000008', 2),
  ('f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000010', 3),
  ('f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000014', 4);


-- 12. TRACK LIKES

INSERT INTO track_likes (user_id, track_id) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010'),
  ('c2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000005'),
  ('c2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000013'),
  ('c2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000015'),
  ('c2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000006'),
  ('c2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000009'),
  ('c2000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000007'),
  ('c2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000016');


-- 13. TRACK REPOSTS
INSERT INTO track_reposts (user_id, track_id) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010'),
  ('c2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000015'),
  ('c2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000004');


-- 14. COMMENTS
INSERT INTO comments (id, user_id, track_id, content, track_timestamp) VALUES
  ('11000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001',
   'ما شاء الله، تلاوة جميلة جداً 🤍', NULL),

  ('11000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000002',
   'd1000000-0000-0000-0000-000000000003',
   'JazakAllahu Khayran, this really hit home', NULL),

  ('11000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000003',
   'd1000000-0000-0000-0000-000000000015',
   'The part about comparison at 12:40 is so real', 760),

  ('11000000-0000-0000-0000-000000000004',
   'c2000000-0000-0000-0000-000000000004',
   'd1000000-0000-0000-0000-000000000009',
   'Needed this today. Bookmarked.', NULL),

  -- Creator replies to comment on their track
  ('11000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001',
   'جزاك الله خيرا 🙏', NULL);

UPDATE comments
   SET parent_comment_id = '11000000-0000-0000-0000-000000000001'
 WHERE id = '11000000-0000-0000-0000-000000000005';

UPDATE comments SET reply_count = 1
 WHERE id = '11000000-0000-0000-0000-000000000001';

UPDATE tracks SET comment_count = (
  SELECT COUNT(*) FROM comments WHERE track_id = tracks.id AND deleted_at IS NULL
);


-- 15. COMMENT LIKES

INSERT INTO comment_likes (user_id, comment_id) VALUES
  ('c2000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004');

UPDATE comments SET like_count = 2 WHERE id = '11000000-0000-0000-0000-000000000001';
UPDATE comments SET like_count = 1 WHERE id = '11000000-0000-0000-0000-000000000003';
UPDATE comments SET like_count = 1 WHERE id = '11000000-0000-0000-0000-000000000004';


-- 16. LISTENING HISTORY
--     trg_track_play_count trigger fires on each INSERT here
INSERT INTO listening_history (user_id, track_id, duration_played, played_at) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 87,   now() - interval '2 days'),
  ('c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000010', 305,  now() - interval '1 day'),
  ('c2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000005', 2700, now() - interval '3 hours'),
  ('c2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000015', 3060, now() - interval '30 minutes'),
  ('c2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000009', 1620, now() - interval '5 days'),
  ('c2000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000007', 3600, now() - interval '1 hour'),
  ('c2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000016', 2640, now() - interval '6 hours');


-- 17. ACTIVITIES
INSERT INTO activities (user_id, type, reference_type, reference_id, target_user_id) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'like',   'track', 'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000003', 'like',   'track', 'd1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000008'),
  ('c2000000-0000-0000-0000-000000000001', 'follow', 'user',  'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000001', 'upload', 'track', 'd1000000-0000-0000-0000-000000000001', NULL),
  ('c1000000-0000-0000-0000-000000000008', 'upload', 'track', 'd1000000-0000-0000-0000-000000000015', NULL);


-- 18. NOTIFICATIONS
INSERT INTO notifications (user_id, type, action_user_id, reference_type, reference_id, is_read) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'like',    'c2000000-0000-0000-0000-000000000001', 'track', 'd1000000-0000-0000-0000-000000000001', false),
  ('c1000000-0000-0000-0000-000000000001', 'comment', 'c2000000-0000-0000-0000-000000000001', 'track', 'd1000000-0000-0000-0000-000000000001', false),
  ('c1000000-0000-0000-0000-000000000008', 'like',    'c2000000-0000-0000-0000-000000000003', 'track', 'd1000000-0000-0000-0000-000000000015', false),
  ('c1000000-0000-0000-0000-000000000005', 'follow',  'c2000000-0000-0000-0000-000000000002', 'user',  'c1000000-0000-0000-0000-000000000005', true);

-- 19. USER PREFERENCES
INSERT INTO user_preferences (user_id, autoplay, explicit_content, audio_quality, language, theme) VALUES
  ('c1000000-0000-0000-0000-000000000001', true,  false, 'high',   'ar', 'dark'),
  ('c1000000-0000-0000-0000-000000000002', true,  false, 'high',   'ar', 'dark'),
  ('c1000000-0000-0000-0000-000000000003', true,  false, 'normal', 'en', 'light'),
  ('c1000000-0000-0000-0000-000000000004', true,  false, 'high',   'ar', 'dark'),
  ('c1000000-0000-0000-0000-000000000005', true,  false, 'normal', 'en', 'light'),
  ('c1000000-0000-0000-0000-000000000006', true,  false, 'normal', 'ar', 'dark'),
  ('c1000000-0000-0000-0000-000000000007', true,  false, 'high',   'en', 'dark'),
  ('c1000000-0000-0000-0000-000000000008', true,  false, 'normal', 'en', 'dark'),
  ('c2000000-0000-0000-0000-000000000001', true,  false, 'normal', 'ar', 'dark'),
  ('c2000000-0000-0000-0000-000000000002', true,  false, 'normal', 'ar', 'light'),
  ('c2000000-0000-0000-0000-000000000003', true,  false, 'low',    'en', 'dark'),
  ('c2000000-0000-0000-0000-000000000004', true,  false, 'normal', 'fr', 'light'),
  ('c2000000-0000-0000-0000-000000000005', false, false, 'high',   'ar', 'dark'),
  ('c2000000-0000-0000-0000-000000000006', true,  false, 'normal', 'ar', 'light');


-- 20. USER PRIVACY SETTINGS
INSERT INTO user_privacy_settings (user_id) VALUES
  ('c1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000004'),
  ('c1000000-0000-0000-0000-000000000005'),
  ('c1000000-0000-0000-0000-000000000006'),
  ('c1000000-0000-0000-0000-000000000007'),
  ('c1000000-0000-0000-0000-000000000008'),
  ('c2000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002'),
  ('c2000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000004'),
  ('c2000000-0000-0000-0000-000000000005'),
  ('c2000000-0000-0000-0000-000000000006');


-- 21. USER CONTENT SETTINGS (for all creators)
INSERT INTO user_content_settings (user_id, rss_title, rss_language, default_license_type) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Sheikh Ahmed Al-Qari RSS',  'ar', 'all_rights_reserved'),
  ('c1000000-0000-0000-0000-000000000002', 'Ustadh Omar RSS',           'ar', 'all_rights_reserved'),
  ('c1000000-0000-0000-0000-000000000003', 'Sister Maryam Podcast RSS', 'en', 'creative_commons'),
  ('c1000000-0000-0000-0000-000000000004', 'Dr. Khalid Tafsir RSS',     'ar', 'all_rights_reserved'),
  ('c1000000-0000-0000-0000-000000000005', 'Layla Mindset RSS',         'en', 'creative_commons'),
  ('c1000000-0000-0000-0000-000000000006', 'Coach Karim RSS',           'en', 'creative_commons'),
  ('c1000000-0000-0000-0000-000000000007', 'Sara Builds RSS',           'en', 'creative_commons'),
  ('c1000000-0000-0000-0000-000000000008', 'Tariq Talks RSS',           'en', 'creative_commons');

COMMIT;