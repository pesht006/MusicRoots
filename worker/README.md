# MusicRoots — воркер заявок (Cloudflare Worker + KV)

Принимает заявки гостей с сайта (имя исполнителя или сообщение об ошибке),
проверяет капчу Turnstile, считает дневной лимит, убирает дубли и складывает всё
в KV. Админ забирает накопленное за день простым текстом по секретной ссылке.

## Что нужно (один раз)

1. Бесплатный аккаунт **Cloudflare**.
2. **Turnstile** (бесплатная капча): в панели Cloudflare → *Turnstile* → *Add site*.
   Получите **Site Key** (публичный, для сайта) и **Secret Key** (для воркера).

## Деплой

```bash
cd worker
npm install

# вход в Cloudflare
npx wrangler login

# создать KV-хранилище и вставить выданный id в wrangler.toml (kv_namespaces.id)
npx wrangler kv namespace create SUBMISSIONS

# секреты
npx wrangler secret put TURNSTILE_SECRET   # Secret Key из Turnstile
npx wrangler secret put ADMIN_TOKEN        # любой длинный случайный пароль

# (необязательно) изменить лимит в wrangler.toml: DAILY_LIMIT = "500"

npx wrangler deploy
```

После деплоя вы получите адрес воркера, напр.:
`https://musicroots-submissions.<ваш-субдомен>.workers.dev`

## Подключение к сайту

В GitHub-репозитории: **Settings → Secrets and variables → Actions → Variables**
добавьте две переменные (это публичные значения):

- `SUBMIT_URL` = адрес воркера (без слэша в конце), напр. `https://musicroots-submissions.xxx.workers.dev`
- `TURNSTILE_SITEKEY` = Site Key из Turnstile

Запустите workflow заново (вкладка **Actions** → Re-run) — сайт пересоберётся и форма
заработает.

## Как админу забрать заявки

Откройте в браузере (подставьте свой ADMIN_TOKEN):

```
https://musicroots-submissions.xxx.workers.dev/admin?token=ВАШ_ADMIN_TOKEN
```

Вернётся обычный текст со списком исполнителей и сообщений об ошибках за сегодня.
За другой день — добавьте `&day=2026-06-09`. Скопируйте список в ChatGPT для чистки,
затем пришлите очищенные имена агенту для внесения на сайт.

## Эндпоинты

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET`  | `/` | проверка работоспособности |
| `POST` | `/submit` | `{ name, token, type?: "artist"\|"error", artist? }` |
| `GET`  | `/admin?token=…&day=YYYY-MM-DD` | текстовая выгрузка за день |

> Заметка: KV не даёт атомарного инкремента, поэтому при экстремальной нагрузке
> счётчик может слегка «плыть». Для целей сбора заявок это некритично.
