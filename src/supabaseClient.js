import { createClient } from "@supabase/supabase-js";

// Estas duas chaves são seguras para estarem aqui, mesmo sendo um projeto
// público no GitHub: a "anon key" é feita para ser pública — quem protege
// os dados a sério são as regras (Row Level Security) configuradas na
// Supabase, não o segredo desta chave.
const SUPABASE_URL = "https://ndsobnbpwwhlvvzpraak.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc29ibmJwd3dobHZ2enByYWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzM5MzMsImV4cCI6MjEwNDEwOTkzM30.4GtGODiaqRhjJYsjbHhoBcs2w827Y5EyX73orW-u1Mc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
