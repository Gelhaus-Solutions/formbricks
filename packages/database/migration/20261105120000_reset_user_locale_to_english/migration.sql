-- The dashboard ships in English only. A user who picked another language before keeps reading English
-- strings, but dates, relative times and the default language of new surveys still followed the stored
-- locale. Reset it, so `User.locale` only ever holds a language the app ships.
--
-- No DDL, so no table lock beyond the updated rows; "User" is small.

UPDATE "User" SET "locale" = 'en-US' WHERE "locale" <> 'en-US';
