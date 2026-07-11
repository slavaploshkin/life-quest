# Life Quest

Личный трекер привычек и тренировок — «преврати жизнь в игру».

Каждая задача — квест. Каждая галочка — выполненный уровень.

## Возможности

- **День** — ежедневные квесты с чекбоксами, урок дня, сон / энергия / настроение
- **Прогресс** — недельный график, лучший/худший день, средний %
- **Зал** — таблица тренировок (упражнения, подходы, веса, чекбоксы)
- **Статистика** — график прогресса по упражнению, средние/макс/мин веса

Данные хранятся локально в браузере. Экспорт/импорт JSON для бэкапа.

## Запуск

```bash
cd life-quest
npm install
npm run dev
```

Открой http://localhost:5173

## На телефон

1. Запусти `npm run dev` и открой с телефона в той же Wi‑Fi сети, **или** задеploy на Vercel
2. В Safari (iOS) / Chrome (Android): «Добавить на экран» — работает как приложение (PWA)

## Сборка

```bash
npm run build
npm run preview
```

## Деплой (Vercel)

**Да — отдельный проект в Vercel**, не внутри slava-search. Это другой сайт (Vite PWA, не Next.js).

### Быстрый старт (без GitHub)

```bash
cd life-quest
npm run build
npx vercel
```

При первом запуске Vercel спросит:
- **Set up and deploy?** → Yes
- **Which scope?** → твой аккаунт
- **Link to existing project?** → **No** (новый проект)
- **Project name?** → `life-quest` (или как хочешь)
- **Directory?** → `./` (ты уже в `life-quest`)
- **Override settings?** → No (Vite определится сам)

### Через GitHub (удобнее для обновлений)

1. Создай репозиторий на GitHub, например `life-quest`
2. Залей код из папки `life-quest/`
3. На [vercel.com/new](https://vercel.com/new) → Import → выбери репо
4. Root Directory: `.` (корень репо)
5. Deploy

### Supabase (синхронизация телефон ↔ компьютер)

Пошагово: **`supabase/SETUP.md`**

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Project URL из Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `VITE_ACCOUNT_1_USERNAME` | логин (без @) |
| `VITE_ACCOUNT_1_NAME` | имя в меню |
| `VITE_ACCOUNT_2_USERNAME` | второй логин |
| `VITE_ACCOUNT_2_NAME` | второе имя |

В Supabase создай пользователей с email `{логин}@life-quest.app` и своим паролем.

Production + Preview → Save → **Redeploy**.

Данные хранятся в облаке и синхронизируются между устройствами. Вход запоминается до `out`.

### Данные

Облако Supabase + локальный кэш в браузере. Экспорт JSON — резервная копия.

### PWA на iPhone

После деплоя открой сайт в Safari → Поделиться → **На экран «Домой»**.

---

*Проект личный, отдельный от slava-search / slava-house.*
