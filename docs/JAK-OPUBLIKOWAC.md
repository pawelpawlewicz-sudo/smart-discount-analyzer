# Jak opublikować Discount Intelligence w Shopify App Store

Poniżej kroki do wykonania. Część odpowiedzi jest już ustalona (hosting Railway, PostgreSQL, szablon polityki) – szczegóły w powiązanych dokumentach.

---

## Hosting i URL (ustawione: Railway)

**Hosting:** Railway.  
**Docelowy URL:** Railway nie przypisuje URL z góry – po pierwszym deployu w projekcie wybierz usługę aplikacji → **Settings** → **Networking** → **Generate Domain**. Otrzymasz adres w formacie **`https://<nazwa>-<fragment>.up.railway.app`**. Ten adres to Twój docelowy URL – ustaw go jako **App URL** i **Redirect URLs** w Partner Dashboard oraz jako **SHOPIFY_APP_URL** w zmiennych Railway.

Pełna instrukcja: **[docs/DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md)** (PostgreSQL, build, start, migracje, zmienne, Partner Dashboard).

---

## Krok 1: Hosting aplikacji (produkcja)

Aplikacja musi być dostępna pod **publicznym adresem HTTPS**. Przy Railway: po wygenerowaniu domeny (Generate Domain) skopiuj URL i użyj go wszędzie tam, gdzie wymagany jest „docelowy URL aplikacji”.

---

## Krok 2: Konfiguracja URL w projekcie

Gdy masz już URL produkcji:

1. W **Partner Dashboard** → Twoja aplikacja → **App setup** ustaw:
   - **App URL** = `https://TWOJ-DOMEN/app`
   - **Allowed redirection URL(s)** = np. `https://TWOJ-DOMEN/api/auth` (zgodnie z tym, co zwraca auth w aplikacji).

2. Opcjonalnie w `shopify.app.toml` możesz wpisać ten sam URL (przy `shopify app deploy` część konfiguracji może być nadpisywana z Partner Dashboard).

---

## Krok 3: Deploy aplikacji

W katalogu projektu:

```bash
npm run build
# Następnie wgraj build + serwer na swój hosting LUB uruchom:
shopify app deploy
```

(`shopify app deploy` wymaga zalogowania do Shopify CLI – `shopify auth login`.)

**Potrzebuję od Ciebie:**  
Czy zamierzasz używać **`shopify app deploy`** (hosting Shopify), czy **własny serwer**? Od tego zależy, czy musimy coś zmienić w konfiguracji.

---

## Krok 4: App Listing w Partner Dashboard

W [partners.shopify.com](https://partners.shopify.com) → **Apps** → Twoja aplikacja → **App listing** (lub **Distribution** → **App Store listing**):

| Pole | Opis |
|------|------|
| **App name** | Np. **Discount Intelligence** (minimalizm) lub **Discount Intelligence – Advanced Discount Analytics** / **Discount Intelligence – Analiza rabatów** (opisowe). Wpisujesz w App Listing bez zmian w kodzie. |
| **Short description** | 1–2 zdania (np. „Analiza rentowności rabatów i rekomendacje produktowe. Wskaż, które rabaty się opłacają.”) |
| **Long description** | Pełny opis: problem, rozwiązanie, funkcje (sync, analiza, rekomendacje z „Dlaczego”, 4 języki, eksport CSV). |
| **Screenshots** | Min. 1, zalecane 3–5. Możesz użyć zrzutów z folderu `presentation/screens/` (dashboard.png, discounts.png, recommendations.png itd.). |
| **Video (optional)** | Link do krótkiego demo (YouTube/Vimeo) – zwiększa konwersję. |
| **Support email** | Adres wsparcia technicznego (wymagany). Np. **support@twojadomena.pl** – wstaw swój adres w App Listing oraz w szablonie polityki prywatności. |
| **Privacy policy URL** | Link do polityki prywatności (wymagany). Szablon tekstu PL+EN: **[docs/PRIVACY-POLICY-TEMPLATE.md](PRIVACY-POLICY-TEMPLATE.md)** – skopiuj, wstaw swój e-mail, opublikuj jako prostą stronę i podaj ten URL. |
| **Pricing** | Plan już jest w kodzie (9,99 USD / 30 dni, 14 dni trial). W listing możesz opisać to tekstem lub ustawić w **App pricing** w Dashboard. |

**Do uzupełnienia:**  
- **Support email** – wpisz w App Listing (np. support@twojadomena.pl) i w szablonie polityki prywatności.  
- **URL polityki prywatności** – użyj szablonu z [PRIVACY-POLICY-TEMPLATE.md](PRIVACY-POLICY-TEMPLATE.md), opublikuj stronę i podaj ten URL w App Listing.

---

## Krok 5: OAuth i App URL w Dashboard

W **Partner Dashboard** → **App setup** (lub **Configuration**):

- **App URL**: Twój produkcyjny URL (np. `https://twoja-domena.com/app`).
- **Redirect URLs**: dokładnie te, które używa Twoja aplikacja (np. `https://twoja-domena.com/api/auth`, `https://twoja-domena.com/auth/callback` – zależnie od `authPathPrefix` w kodzie).

Bez poprawnego HTTPS i tych URL-i recenzja się nie powiedzie.

---

## Krok 6: Submit for review

Gdy:

- aplikacja działa w produkcji pod HTTPS,
- App URL i Redirect URLs są ustawione,
- listing ma wypełnione: opis, zrzuty, support email, privacy policy URL,

w Partner Dashboard wybierz **Submit for review** (lub **Submit app**). Recenzja zwykle trwa **2–10 dni**. Często dostaniesz listę drobnych poprawek – wtedy poprawiasz i wysyłasz ponownie.

---

## Podsumowanie – co masz gotowe

| Temat | Status |
|-------|--------|
| **Hosting** | Railway – instrukcja: [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md). |
| **URL po deployu** | Railway daje URL po **Generate Domain** (Settings → Networking). Format: `https://...up.railway.app`. |
| **Baza** | PostgreSQL (Prisma skonfigurowane, migracja `20260207160000_init_postgres`). |
| **Polityka prywatności** | Szablon PL+EN: [PRIVACY-POLICY-TEMPLATE.md](PRIVACY-POLICY-TEMPLATE.md). Wstaw swój e-mail, opublikuj stronę, podaj URL w App Listing. |
| **Nazwa w App Store** | Np. „Discount Intelligence” lub „Discount Intelligence – Advanced Discount Analytics”. |
| **Support email** | Wstaw w App Listing i w szablonie polityki (np. support@twojadomena.pl). |
