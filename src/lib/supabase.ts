import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = 'https://znwwfufkwbnuxxezzijb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpud3dmdWZrd2JudXh4ZXp6aWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjY3NTQsImV4cCI6MjA5MTEwMjc1NH0.wyuVqBGWobxmbfjTzhB8UPDS7ZELhGgij4Xt3BKxWCo';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);