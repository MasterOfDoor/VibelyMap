-- Supabase Reviews Table Creation
-- Run this SQL in Supabase SQL Editor

CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL,
  reviewer_address TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  detailed_ratings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_reviews_place_id ON reviews(place_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_address);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read reviews
CREATE POLICY "Allow public read access" ON reviews
  FOR SELECT USING (true);

-- Policy to allow authenticated users to insert reviews
CREATE POLICY "Allow insert for all" ON reviews
  FOR INSERT WITH CHECK (true);
