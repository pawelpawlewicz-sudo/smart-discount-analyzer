# Deploy Discount Intelligence na Railway

Instrukcja wdrożenia aplikacji na Railway z PostgreSQL. Po pierwszym deployu otrzymasz **docelowy URL** (np. `https://twoja-usługa.up.railway.app`), który ustawisz w Shopify Partner Dashboard.

---

## 1. Jak wygląda URL po deployu (Railway)

Po wdrożeniu usługi na Railway:

1. W projekcie Railway otwórz **usługę** (serwis z Twoją aplikacją).
2. W prawym panelu: **Settings** → sekcja **Networking**.
3. Kliknij **Generate Domain**.
4. Railway wygeneruje domenę w formacie:
   - **`https://<nazwa-usługi>-<losowy-fragment>.up.railway.app`**  
   np. `https://smart-discount-analyzer-production-a1b2c3.up.railway.app`

Ten adres to **docelowy URL aplikacji**. Użyjesz go jako:

- **App URL** w Shopify Partner Dashboard: `https://TWOJ-ADRES.up.railway.app/app`
- **Redirect URL(s)** w Dashboard: `https://TWOJ-ADRES.up.railway.app/api/auth` (lub zgodnie z konfiguracją auth w aplikacji)
- Zmienna środowiskowa **`SHOPIFY_APP_URL`**: `https://TWOJ-ADRES.up.railway.app` (bez `/app` na końcu, jeśli Twoja aplikacja tak tego oczekuje – sprawdź `shopify.server.js`)

Dopóki nie wygenerujesz domeny, usługa nie będzie publicznie dostępna. Po wygenerowaniu domeny **od razu skopiuj ją** i uzupełnij konfigurację w Railway (SHOPIFY_APP_URL) oraz w Partner Dashboard.

---

## 2. Konto i projekt Railway

1. Wejdź na [railway.app](https://railway.app) i zaloguj się (np. przez GitHub).
2. **New Project**.
3. Wybierz **Deploy from GitHub repo** i wskaż repozytorium z Discount Intelligence (albo **Empty project** i połączysz repo w kolejnym kroku).

---

## 3. Baza danych PostgreSQL

1. W projekcie Railway: **+ New** → **Database** → **PostgreSQL**.
2. Railway utworzy usługę Postgres i ustawi zmienną **`DATABASE_URL`** (widoczną w **Variables**).
3. Skopiuj `DATABASE_URL` – przyda się, jeśli będziesz uruchamiać migracje lokalnie przeciwko tej bazie. W samej aplikacji na Railway `DATABASE_URL` zostanie ustawione automatycznie w środowisku po połączeniu usług (patrz niżej).

---

## 4. Usługa aplikacji (serwer Node)

1. W tym samym projekcie: **+ New** → **GitHub Repo** (lub **Empty Service** i połącz repo później).
2. Wybierz repozytorium z aplikacją i (opcjonalnie) branch do deployu.
3. Po połączeniu repo Railway wykryje projekt (Node/npm). Ustaw **Root Directory** na katalog z `package.json` (zazwyczaj katalog główny repo).
4. **Settings** tej usługi:
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm run start`  
     (najpierw migracje, potem start serwera)
   - **Watch Paths**: zostaw domyślne (np. całe repo), żeby push do repo uruchamiał nowy deploy.

---

## 5. Zmienne środowiskowe (Variables)

**WAŻNE:** Bez zmiennej `DATABASE_URL` w usłudze aplikacji deploy się **wywali** (błąd Prisma: „Environment variable not found: DATABASE_URL”). Ta zmienna jest w usłudze PostgreSQL – musisz ją **dodać do usługi aplikacji** (referencja lub wklejenie).

W usłudze **smart-discount-analyzer** (aplikacja, nie baza) → **Variables** → **+ New Variable**:

1. **DATABASE_URL** – **obowiązkowe.**  
   - Opcja A: **Add Variable** → **Add reference** (lub „Reference”) → wybierz usługę **PostgreSQL** → z listy zmiennych wybierz **`DATABASE_URL`**.  
   - Opcja B: W usłudze PostgreSQL → Variables skopiuj wartość `DATABASE_URL` i w usłudze aplikacji dodaj zmienną `DATABASE_URL` z wklejonym connection stringiem.  
   Po zapisaniu zrób **Redeploy** usługi aplikacji.

Pozostałe zmienne w tej samej usłudze aplikacji:

| Zmienna | Opis | Przykład |
|--------|------|----------|
| `DATABASE_URL` | Adres PostgreSQL (patrz wyżej) | Referencja z usługi PostgreSQL lub wklejony connection string. |
| `SHOPIFY_API_KEY` | Z Partner Dashboard → App → Client credentials | Wklej API Key |
| `SHOPIFY_API_SECRET` | To samo miejsce | Wklej API Secret |
| `SCOPES` | Uprawnienia (po przecinku) | `read_orders,read_products,read_discounts,read_price_rules,read_inventory,write_discounts` |
| `SHOPIFY_APP_URL` | **URL Twojej aplikacji** (bez ścieżki `/app`) | Po wygenerowaniu domeny: `https://twoja-usługa-xxx.up.railway.app` |
| `NODE_ENV` | Środowisko | `production` |

**SHOPIFY_APP_URL jest wymagane do startu aplikacji** – bez niego serwer się wywali z błędem „Detected an empty appUrl configuration”. Najpierw wygeneruj domenę (krok 6), skopiuj URL i dodaj go jako `SHOPIFY_APP_URL`. Jeśli domeny jeszcze nie ma, możesz tymczasowo ustawić `https://placeholder.up.railway.app`, potem po **Generate Domain** podmienić na prawdziwy adres i zrobić Redeploy.

---

## 6. Domena (publiczny URL)

1. W usłudze aplikacji: **Settings** → **Networking**.
2. **Generate Domain**.
3. Skopiuj wyświetlony adres (np. `https://smart-discount-analyzer-production-xyz.up.railway.app`).
4. W **Variables** tej samej usługi ustaw **`SHOPIFY_APP_URL`** na ten adres (bez `/app`).
5. (Opcjonalnie) **Redeploy** usługi, żeby nowa wartość `SHOPIFY_APP_URL` była użyta.

Ten adres to **docelowy URL aplikacji** – użyj go w Partner Dashboard jak w rozdziale 1.

---

## 7. Migracje Prisma (PostgreSQL)

Migracje uruchamiane są przy starcie aplikacji dzięki:

**Start Command:** `npx prisma migrate deploy && npm run start`

Jeśli chcesz uruchomić migracje ręcznie (np. z lokalnego komputera przeciwko bazie na Railway):

1. W Railway: usługa PostgreSQL → **Variables** → skopiuj `DATABASE_URL`.
2. Lokalnie: `DATABASE_URL="postgresql://..." npx prisma migrate deploy`

W projekcie jest jedna migracja dla Postgres: `20260207160000_init_postgres`. Tworzy tabele: Session, Shop, DiscountAnalysis, ProductDiscountPerformance, Recommendation, SyncLog.

---

## 8. Po deployu – Shopify Partner Dashboard

1. **Partners** → [partners.shopify.com](https://partners.shopify.com) → Twoja aplikacja.
2. **App setup** (lub **Configuration**):
   - **App URL**: `https://TWOJ-ADRES.up.railway.app/app`
   - **Allowed redirection URL(s)**:
     - `https://TWOJ-ADRES.up.railway.app/api/auth`
     - (inne, jeśli wymagane przez auth – sprawdź `authPathPrefix` w kodzie)
3. Zapisz zmiany.

Dzięki temu OAuth i embedded app będą działały pod wygenerowanym adresem Railway.

---

## 9. Rozwój lokalny z PostgreSQL

Schema Prisma jest ustawiony na **PostgreSQL** (`provider = "postgresql"`, `url = env("DATABASE_URL")`).

Opcje lokalnego devu:

- **PostgreSQL w Dockerze**  
  `docker run -d --name shopify-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shopify_dev -p 5432:5432 postgres:16`  
  W `.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shopify_dev"`

- **Neon** (darmowa baza w chmurze): [neon.tech](https://neon.tech) → utwórz projekt → skopiuj connection string do `DATABASE_URL` w `.env`.

Potem: `npx prisma migrate deploy` (lub `prisma migrate dev`) i `shopify app dev` (z tunnem).

---

## 10. Podsumowanie – co gdzie ustawić

| Gdzie | Co |
|-------|-----|
| **Railway – usługa app** | Build: `npm install && npx prisma generate && npm run build`; Start: `npx prisma migrate deploy && npm run start`; Variables: `DATABASE_URL` (referencja), `SHOPIFY_*`, `SCOPES`, `SHOPIFY_APP_URL`, `NODE_ENV=production`. |
| **Railway – Networking** | Generate Domain → skopiować URL. |
| **Partner Dashboard** | App URL = `https://...up.railway.app/app`; Redirect = `https://...up.railway.app/api/auth`. |
| **Support email** | W App Listing wpisz swój adres (np. support@twojadomena.pl). |
| **Polityka prywatności** | Użyj szablonu z `docs/PRIVACY-POLICY-TEMPLATE.md` i wstaw URL w App Listing. |

Po pierwszym deployu i wygenerowaniu domeny **docelowy URL aplikacji** to po prostu wyświetlony adres `https://....up.railway.app` – ten sam wpisujesz w `SHOPIFY_APP_URL` i w Partner Dashboard jak wyżej.
