-- Laring AI - Supabase Database Schema
-- Paste this script into the Supabase SQL Editor and click "Run".

-- 1. Table for Security Alerts (physical contact, aggression, suspicious objects)
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    parties JSONB DEFAULT '[]'::jsonb,
    severity TEXT DEFAULT 'medium'
);

-- Index for ordering alerts by newest first
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON security_alerts(created_at DESC);

-- 2. Table for Room Telemetry Statistics (Periodic snapshots)
CREATE TABLE IF NOT EXISTS room_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    people_count INTEGER NOT NULL,
    objects_detected JSONB DEFAULT '[]'::jsonb NOT NULL,
    dominant_emotion TEXT
);

-- Index for ordering stats snapshots by newest first
CREATE INDEX IF NOT EXISTS idx_stats_created_at ON room_statistics(created_at DESC);

-- 3. Table for Game Leaderboard (mimicry game high scores)
CREATE TABLE IF NOT EXISTS game_leaderboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    high_score INTEGER NOT NULL
);

-- Index for ordering leaderboard from highest score to lowest
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON game_leaderboard(score DESC);
