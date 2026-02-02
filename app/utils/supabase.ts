import { createClient } from "@supabase/supabase-js";

// Comments Supabase env variable names (from Vercel)
const supabaseUrl = process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL || "https://placeholder-url.supabase.co";

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_PUBLISHABLE_KEY ||
  process.env.comments_SUPABASE_ANON_KEY ||
  process.env.comments_SUPABASE_PUBLISHABLE_KEY ||
  "placeholder-key";

if (!process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL) {
  console.warn("Comments Supabase URL missing. Database operations will fail.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
