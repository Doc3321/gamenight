-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  game_state TEXT NOT NULL DEFAULT 'waiting' CHECK (game_state IN ('waiting', 'playing', 'finished')),
  current_topic TEXT,
  game_word TEXT,
  game_mode TEXT CHECK (game_mode IN ('similar-word', 'imposter', 'mixed')),
  current_spin INTEGER DEFAULT 0,
  total_spins INTEGER DEFAULT 3,
  spin_order JSONB,
  player_order JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table (junction table for room players)
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  player_name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_ready BOOLEAN DEFAULT FALSE,
  player_index INTEGER, -- Position in game (1-based)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Game state table (for real-time game state)
CREATE TABLE game_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_player_index INTEGER DEFAULT 0,
  current_spin INTEGER,
  voting_phase BOOLEAN DEFAULT FALSE,
  current_voting_player_index INTEGER,
  voting_activated BOOLEAN DEFAULT FALSE,
  eliminated_player JSONB,
  is_tie BOOLEAN DEFAULT FALSE,
  tied_players JSONB,
  wrong_elimination BOOLEAN DEFAULT FALSE,
  player_words JSONB, -- { playerId: { word, type } }
  votes JSONB, -- { voteId: { voterId, targetId, voteType } }
  emotes JSONB, -- Array of { playerId, emote, timestamp }
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id)
);

-- Indexes for performance
CREATE INDEX idx_rooms_game_state ON rooms(game_state);
CREATE INDEX idx_rooms_host_id ON rooms(host_id);
CREATE INDEX idx_room_players_room_id ON room_players(room_id);
CREATE INDEX idx_room_players_user_id ON room_players(user_id);
CREATE INDEX idx_game_states_room_id ON game_states(room_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_states_updated_at BEFORE UPDATE ON game_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms;
DROP POLICY IF EXISTS "Host can update their room" ON rooms;
DROP POLICY IF EXISTS "Anyone can view room players" ON room_players;
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON room_players;
DROP POLICY IF EXISTS "Users can update their own player status" ON room_players;
DROP POLICY IF EXISTS "Host can remove players" ON room_players;
DROP POLICY IF EXISTS "Anyone can view game state" ON game_states;
DROP POLICY IF EXISTS "Players can insert game state" ON game_states;
DROP POLICY IF EXISTS "Players can update game state" ON game_states;

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Rooms policies
-- Anyone can read rooms (for joining)
CREATE POLICY "Anyone can view rooms" ON rooms
  FOR SELECT USING (true);

-- Only authenticated users can create rooms (auth checked in app via Clerk)
CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT WITH CHECK (true);

-- Host can update their room (auth checked in app via Clerk)
CREATE POLICY "Host can update their room" ON rooms
  FOR UPDATE USING (true);

-- Room players policies
-- Anyone can view room players (for lobby)
CREATE POLICY "Anyone can view room players" ON room_players
  FOR SELECT USING (true);

-- Authenticated users can join rooms (auth checked in app via Clerk)
CREATE POLICY "Authenticated users can join rooms" ON room_players
  FOR INSERT WITH CHECK (true);

-- Users can update their own player status (auth checked in app via Clerk)
CREATE POLICY "Users can update their own player status" ON room_players
  FOR UPDATE USING (true);

-- Host can remove players (auth checked in app via Clerk)
CREATE POLICY "Host can remove players" ON room_players
  FOR DELETE USING (true);

-- Game states policies
-- Anyone can view game state
CREATE POLICY "Anyone can view game state" ON game_states
  FOR SELECT USING (true);

-- Players can insert game state (auth checked in app via Clerk)
CREATE POLICY "Players can insert game state" ON game_states
  FOR INSERT WITH CHECK (true);

-- Players can update game state (auth checked in app via Clerk)
CREATE POLICY "Players can update game state" ON game_states
  FOR UPDATE USING (true);

-- Function to check if user is in room
CREATE OR REPLACE FUNCTION is_user_in_room(room_id_param TEXT, user_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = room_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

