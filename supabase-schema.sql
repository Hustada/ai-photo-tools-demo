-- Supabase Schema for AI Photo Tools
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- Photo enhancements table
CREATE TABLE IF NOT EXISTS photo_enhancements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  ai_description TEXT,
  accepted_ai_tags TEXT[] DEFAULT '{}',
  suggestion_source TEXT DEFAULT 'Unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_photo_id ON photo_enhancements(photo_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON photo_enhancements(user_id);
CREATE INDEX IF NOT EXISTS idx_tags ON photo_enhancements USING GIN(accepted_ai_tags);
CREATE INDEX IF NOT EXISTS idx_created_at ON photo_enhancements(created_at DESC);

-- Add updated_at trigger to automatically update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_photo_enhancements_updated_at 
  BEFORE UPDATE ON photo_enhancements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional but recommended)
ALTER TABLE photo_enhancements ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (you can restrict later)
CREATE POLICY "Enable all operations for authenticated and anon users" 
  ON photo_enhancements
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Optional: Blog posts table for future use
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger for blog posts
CREATE TRIGGER update_blog_posts_updated_at 
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON photo_enhancements TO anon, authenticated;
GRANT ALL ON blog_posts TO anon, authenticated;

-- Success message
SELECT 'Schema created successfully! Your tables are ready to use.' as message;