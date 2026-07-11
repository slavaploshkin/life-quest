# Supabase setup for Life Quest

## 1. Run SQL schema

In Supabase dashboard:

1. Open **SQL Editor**
2. **New query**
3. Paste everything from `supabase/schema.sql`
4. Click **Run**

## 2. Get API keys

1. Open **Project Settings** → **API** (or **API Keys**)
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `VITE_SUPABASE_ANON_KEY`

**Important:** use **Publishable**, NOT **Secret** (`sb_secret_...`).

| Key | Starts with | Where to use |
|-----|-------------|--------------|
| Publishable | `sb_publishable_` | ✅ Vercel, browser, phone app |
| Secret | `sb_secret_` | ❌ Never in the app — server only |

If you still see legacy keys (`eyJ...` **anon**), that works too — same role as Publishable.

## 3. Login stays the same

You still enter **your old login and password** from Vercel env:

- `VITE_ACCOUNT_1_USERNAME` / `VITE_ACCOUNT_1_PASSWORD`
- `VITE_ACCOUNT_2_USERNAME` / `VITE_ACCOUNT_2_PASSWORD`

You do **not** need to create users manually in Supabase.

On first login the app creates the cloud account automatically in the background.

Optional: in Supabase → **Authentication** → **Providers** → **Email**, disable **Confirm email** so first login is instant.

## How sync works

- Data is stored in `user_snapshots` table (JSON)
- Phone and computer use the same Supabase account → same data
- Changes sync automatically (realtime + save on edit)
- Old local browser data uploads to cloud on first login if cloud is empty

## Free tier

Supabase **FREE** plan is enough for two personal users.
