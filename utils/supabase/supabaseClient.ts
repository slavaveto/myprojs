import { createClient } from '@supabase/supabase-js';

// Получаем значения из переменных окружения
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Создаём клиент Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);
