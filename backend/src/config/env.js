require('dotenv').config();

const cleanSupabaseUrl = (url) => {
  if (!url) return '';
  // Remove any trailing slashes or paths
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    return url.replace(/\/+$/, '');
  }
};

const supabaseUrl = cleanSupabaseUrl(process.env.SUPABASE_URL);

// Simple validation
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  throw new Error('Invalid SUPABASE_URL: Must start with https://');
}

if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
  throw new Error('Invalid SUPABASE_URL: Must be a valid supabase.co host');
}

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: supabaseUrl,
    key: process.env.SUPABASE_SERVICE_KEY
  },
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    apiKey: process.env.AI_SERVICE_KEY
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN
  }
};

module.exports = env;