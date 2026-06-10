-- PBKDF2-SHA256 hashes for current demo users.
-- Keeps existing test passwords working:
--   bartender / 123456
--   accountant / 123456
--   bartender1 / 1234567

update public.users
set password_hash = case login
  when 'bartender' then 'pbkdf2$sha256$210000$5drDpDddmIU5HNi6XgJWjA$q-yPWLxEzF28T541zZ79qiKTWIQG7poCrUdIx62Y6_o'
  when 'accountant' then 'pbkdf2$sha256$210000$5drDpDddmIU5HNi6XgJWjA$q-yPWLxEzF28T541zZ79qiKTWIQG7poCrUdIx62Y6_o'
  when 'bartender1' then 'pbkdf2$sha256$210000$H-GxDNGXVWAFtUZ5vLL96w$yrBjPyY_wXu7lPsv0ZXuwmoDKi4R3m_T608qdwPoRhM'
  else password_hash
end
where login in ('bartender', 'accountant', 'bartender1');

