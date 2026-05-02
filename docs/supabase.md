# Supabase Setup

Use Supabase for PopValue profiles and cloud-saved collections.

## 1. Create a Project

Create a Supabase project, then open the project dashboard.

## 2. Run the Schema

Open SQL Editor and run:

```sql
-- Paste the contents of supabase/schema.sql
```

The schema creates:

- `profiles`
- `collection_entries`
- Row Level Security policies so each user can only access their own rows

## 3. Configure Auth URLs

In Authentication settings:

- Site URL: `https://popvalue.vercel.app`
- Redirect URLs:
  - `https://popvalue.vercel.app`
  - `http://localhost:5173`

## 4. Add Environment Variables

In Vercel project settings, add these for Production:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Use the public anon key only. Do not use the service role key in PopValue frontend environment variables.

## 5. Redeploy

Redeploy PopValue after adding the env vars. The Profile card will switch from setup-needed mode to email login mode.
