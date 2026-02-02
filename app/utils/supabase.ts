import { createClient } from "@supabase/supabase-js";

// Support multiple env variable naming conventions
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL ||
  "https://placeholder-url.supabase.co";

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY ||
  "placeholder-key";

const hasCredentials = 
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_comments_CommentSUPABASE_URL) &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_comments_CommentSUPABASE_ANON_KEY);

if (!hasCredentials) {
  console.warn("Supabase credentials missing. Database operations will fail.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
