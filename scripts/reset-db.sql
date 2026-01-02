-- Database Reset Script (SQL Version)
-- Run this in Supabase SQL Editor to clear all data

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Clear all tables in correct order
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE user_preferences CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify tables are empty
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'user_preferences', COUNT(*) FROM user_preferences
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'documents', COUNT(*) FROM documents;
