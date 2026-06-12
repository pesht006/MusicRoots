# MusicRoots — воркер заявок (Cloudflare Worker + KV)

Принимает заявки гостей с сайта (имя исполнителя или сообщение об ошибке),
проверяет капчу Turnstile, считает дневной лимит, убирает дубли и складывает всё
в KV. Админ забирает накопленное за день простым текстом по секретной ссылке.

## Капча: Turnstile или hCaptcha

Воркер сам определяет провайдера по выставленному секрету:

- если задан секрет **`HCAPTCHA_SECRET`** → проверяется **hCaptcha** (видимая капча
  с картинками/«мозаикой»);
- иначе если задан **`TURNSTILE_SECRET`** → проверяется **Cloudflare Turnstile**;
- если ни один секрет не задан → проверка капчи пропускается (для локальной отладки).

На сайте провайдер выбирается аналогично: если задана переменная сборки
`HCAPTCHA_SITEKEY` — используется hCaptcha, иначе `TURNSTILE_SITEKEY`.

> Если капча не проходит, воркер возвращает поле `codes` (коды ошибок провайдера,
> напр. `invalid-input-secret` — неверный секрет, `invalid-input-response` —
> просроченный/чужой токен, `timeout-or-duplicate` — повторное использование).
> Это помогает быстро понять причину.

## Что нужно (один раз)

1. Бесплатный аккаунт **Cloudflare**.
2. Капча — **один** из вариантов:
   - **Turnstile** (лёгкая): Cloudflare → *Turnstile* → *Add site* → получите
     **Site Key** и **Secret Key**. Домен сайта (`pesht006.github.io`) должен быть в
     списке разрешённых доменов виджета.
   - **hCaptcha** (мозаика): зарегистрируйтесь на hcaptcha.com → создайте site →
     получите **Site Key** и **Secret Key**.

## Деплой

```bash
cd worker
npm install

# вход в Cloudflare
npx wrangler login

# создать KV-хранилище и вставить выданный id в wrangler.toml (kv_namespaces.id)
npx wrangler kv namespace create SUBMISSIONS

# секреты (для Turnstile)
npx wrangler secret put TURNSTILE_SECRET   # Secret Key из Turnstile
#   ИЛИ для hCaptcha (мозаика):
#   npx wrangler secret put HCAPTCHA_SECRET
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
- `TURNSTILE_SITEKEY` = Site Key из Turnstile **или** `HCAPTCHA_SITEKEY` = Site Key из hCaptcha

> После изменения кода воркера (`worker/src/index.js`) выполните `npx wrangler deploy`
> заново — воркер работает на вашем аккаунте Cloudflare и не обновляется автоматически.

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
