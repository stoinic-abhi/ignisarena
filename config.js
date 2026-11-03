// config.js — Live Supabase Cloud Credentials (Supports Both SUPABASE_CONFIG & APP_CONFIG)

const SUPABASE_CONFIG = {
  URL: "https://ihhdyqnqxjrlkvipivyz.supabase.co",
  ANON_KEY: "sb_publishable_90X6vGV0iBEG_ffIf11e5g_LsK6iF2Y",
  SUPABASE_URL: "https://ihhdyqnqxjrlkvipivyz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_90X6vGV0iBEG_ffIf11e5g_LsK6iF2Y"
};

const APP_CONFIG = {
  SUPABASE_URL: SUPABASE_CONFIG.URL,
  SUPABASE_ANON_KEY: SUPABASE_CONFIG.ANON_KEY,
  URL: SUPABASE_CONFIG.URL,
  ANON_KEY: SUPABASE_CONFIG.ANON_KEY
};

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.APP_CONFIG = APP_CONFIG;
window.SUPABASE_URL = SUPABASE_CONFIG.URL;
window.SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;
