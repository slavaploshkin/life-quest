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

## 3. Create two users

1. Open **Authentication** → **Users**
2. Click **Add user** → **Create new user**

For each person create one user:

| Field | Example |
|-------|---------|
| Email | `slava@life-quest.app` |
| Password | your password |
| Auto confirm user | ✅ on |

Important: email must be `{login}@life-quest.app` — the same login you type in the app.

Repeat for the second person, e.g. `joe@life-quest.app`.

## 4. Disable public signup (recommended)

1. **Authentication** → **Providers** → **Email**
2. Turn off **Enable sign ups** if available, or leave only invited users

Only the two accounts you created manually can log in.

## 5. Optional display names

In Vercel env (or `.env`):

```env
VITE_ACCOUNT_1_USERNAME=slava
VITE_ACCOUNT_1_NAME=Slava

VITE_ACCOUNT_2_USERNAME=joe
VITE_ACCOUNT_2_NAME=Joe
```

These only change the letter badge in the menu — login still uses Supabase email/password.

## How sync works

- Data is stored in `user_snapshots` table (JSON)
- Phone and computer use the same Supabase account → same data
- Changes sync automatically (realtime + save on edit)
- Old local browser data uploads to cloud on first login if cloud is empty

## Free tier

Supabase **FREE** plan is enough for two personal users.
