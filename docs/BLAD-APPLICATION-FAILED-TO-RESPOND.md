# „Application failed to respond” przy instalacji

Ten błąd oznacza, że Shopify nie dostał poprawnej odpowiedzi z Twojej aplikacji (Railway). Poniżej co sprawdzić i jak znaleźć przyczynę.

---

## 0. Szybki test po deployu (zrób to najpierw)

Po wdrożeniu na Railway od razu sprawdź w przeglądarce lub `curl`:

| URL | Oczekiwane | Co oznacza |
|-----|------------|------------|
| `https://discountintelligence.up.railway.app/health` | **200 OK** | Serwer działa. Problem jest w ścieżce `/app` (auth/billing/baza). |
| `https://discountintelligence.up.railway.app/diagnostic` | **200** + JSON | Sprawdza: czy `SHOPIFY_APP_URL` i `DATABASE_URL` są ustawione, czy baza odpowiada. |

Jeśli **/health** zwraca 200, a **/diagnostic** pokazuje `SHOPIFY_APP_URL_set: false` lub `database_ok: false` – popraw zmienne w Railway (Variables) i zrób Redeploy. Jeśli **/health** nie odpowiada – serwer się nie uruchamia; zobacz **Deploy logs** (build/start).

---

## 1. Logi na Railway (najważniejsze)

1. Wejdź na **Railway** → projekt → usługa **smart-discount-analyzer**.
2. Otwórz **Deployments** → ostatni deployment → **View logs** (albo **Logs**).
3. Uruchom ponownie **instalację w sklepie** (Test your app / Install).
4. W logach szukaj:
   - **crash** / **Error** / **exit code** – serwer się wyłącza.
   - **`[app.jsx loader]`** – błąd z loadera (dodałem log).
   - **Prisma** / **ECONNREFUSED** – problem z połączeniem do bazy.
   - **SHOPIFY_APP_URL** / **empty appUrl** – brak zmiennej w Variables.

Jeśli w logach widać konkretny błąd, napraw go (np. brak `DATABASE_URL`, `SHOPIFY_APP_URL`, błąd zapytania do bazy).

---

## 2. Zmienne środowiskowe (Railway → Variables)

W usłudze aplikacji muszą być ustawione:

| Zmienna | Wymagane | Uwagi |
|--------|----------|--------|
| `DATABASE_URL` | Tak | Referencja do Postgresa lub pełny connection string. |
| `SHOPIFY_APP_URL` | Tak | Dokładnie: `https://discountintelligence.up.railway.app` (bez `/app`). |
| `SHOPIFY_API_KEY` | Tak | Z Partner Dashboard → Client credentials. |
| `SHOPIFY_API_SECRET` | Tak | To samo miejsce. |
| `SCOPES` | Tak | Np. `read_orders,read_products,read_discounts,read_price_rules,read_inventory,write_discounts` |
| `NODE_ENV` | Tak | `production` |

Brak `SHOPIFY_APP_URL` lub błędna wartość często kończy się crash przy starcie („empty appUrl”).

---

## 3. Partner Dashboard – App URL i Redirect

- **App URL:** `https://discountintelligence.up.railway.app/app` (z **/app** na końcu).
- **Allowed redirection URL(s):** `https://discountintelligence.up.railway.app/auth` i `https://discountintelligence.up.railway.app/auth/callback`

Źle ustawione URL-e powodują błędne przekierowania i wrażenie „app nie odpowiada”.

---

## 4. Status deploymentu na Railway

- W **Deployments** sprawdź, czy ostatni deploy ma status **Success** / **Active**, a nie **Crashed**.
- Jeśli **Crashed** – wejdź w **Deploy logs** / **Build logs** i zobacz, przy którym kroku jest błąd (build, migracje, start).

---

## 5. Szybki test odpowiedzi serwera

**Health check (bez auth i bazy):**

```bash
curl -I https://discountintelligence.up.railway.app/health
```

Oczekiwane: **200 OK**. Jeśli dostaniesz 200 – serwer działa, problem jest w ścieżce `/app` (auth, billing lub baza). Jeśli timeout / brak odpowiedzi – serwer nie startuje lub crashuje (sprawdź Deploy logs).

**Strona główna:**

```bash
curl -I https://discountintelligence.up.railway.app/
```

Oczekiwane: odpowiedź HTTP (np. 302, 200). Jeśli nie ma odpowiedzi – problem po stronie Railway (serwer nie działa / crash przy starcie).

---

## 6. 502 od Railway (curl /health zwraca 502)

Jeśli **nawet** `curl https://.../health` zwraca **502** i w odpowiedzi jest `"message":"Application failed to respond"` oraz **`server: railway-edge`** – to **aplikacja w ogóle nie odpowiada** (proces się nie uruchomił lub nasłuchuje na złym adresie).

**Typowe przyczyny:**

| Przyczyna | Co zrobić |
|-----------|-----------|
| **Serwer nasłuchuje tylko na localhost** | W Railway → Variables dodaj **`HOST`** = **`0.0.0.0`**. Albo w Start Command użyj: `npm run setup && npm run start:railway`. |
| **Crash przy starcie** (brak zmiennej, błąd Prisma) | Railway → Deployments → ostatni deploy → **View logs**. Szukaj błędu zaraz po starcie (np. „Environment variable not found: DATABASE_URL”, „empty appUrl”, stack trace). |
| **Brak zmiennych** | Sprawdź Variables: `DATABASE_URL`, `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `NODE_ENV=production`. |

## 7. Typowe przyczyny (logi / zachowanie)

| Objaw w logach / zachowaniu | Co zrobić |
|-----------------------------|-----------|
| „Environment variable not found: DATABASE_URL” | W Railway → Variables dodać `DATABASE_URL` (referencja do Postgres lub wpis ręczny). |
| „empty appUrl configuration” | Ustawić `SHOPIFY_APP_URL` w Variables i zrobić Redeploy. |
| ECONNREFUSED do bazy / Prisma timeout | Sprawdzić, czy usługa Postgres w Railway działa i czy `DATABASE_URL` jest poprawny. |
| Crash po `billing.require` / authenticate | Sprawdzić `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` i URL w Dashboard. |
| Deployment w stanie Crashed | Otworzyć Deploy logs i naprawić błąd z build/start. |

Po każdej zmianie zmiennych lub kodu zrób **Redeploy** usługi i spróbuj instalacji jeszcze raz. Jeśli w logach pojawi się konkretny komunikat błędu, napraw go według powyższej tabeli.
