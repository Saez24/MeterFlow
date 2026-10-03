export const environment = {
  production: true,
  // Supabase project URL + anon (publishable) key. The anon key is public by
  // design — RLS protects the data. Never put the service-role key here.
  // CI/Docker may overwrite this file with values from secrets.
  supabaseUrl: 'http://localhost:54321',
  supabaseKey: 'public-anon-key',
};
