# Checklista przed publikacją – Discount Intelligence

Przed wysłaniem aplikacji do recenzji Shopify App Store upewnij się, że poniższe punkty są spełnione.

---

## 1. Zarabianie (Shopify Billing API)

### Zaimplementowane
- **Recurring subscription** w `app/shopify.server.js`: plan **Discount Intelligence Pro** ($9.99 / 30 dni, USD).
- **Darmowy trial**: 14 dni (`trialDays: 14`).
- **Wymaganie płatności**: w `app/routes/app.jsx` loader wywołuje `billing.require()` – bez aktywnej subskrypcji merchant jest przekierowywany do zatwierdzenia płatności u Shopify.

### Do zrobienia przed produkcją
- [ ] Ustaw prawdziwy **application_url** i **redirect_urls** w `shopify.app.toml` (lub przez `shopify app deploy` / Partner Dashboard) – zastąp `https://example.com`.
- [ ] W produkcji ustaw `isTest: false` w `app.jsx` (obecnie `isTest = (NODE_ENV !== "production")`).
- [ ] Opcjonalnie: **Managed App Pricing** w Partner Dashboard – możesz zdefiniować plany w panelu zamiast w kodzie ([dokumentacja](https://shopify.dev/docs/apps/launch/billing/managed-pricing)).
- [ ] Prowizja Shopify: 0% od pierwszego 1 000 000 USD rocznie po rejestracji ($19). Powyżej – 15%.

### Inne modele (opcjonalnie)
- **Usage charges**: `billing.createUsageRecord()` – np. opłata za każdy wyeksportowany raport.
- **One-time**: mutacja `appPurchaseOneTimeCreate` – np. jednorazowa opłata za instalację.

---

## 2. Wymagania App Store

### Embedded App + App Bridge
- **Tak**: `embedded = true` w `shopify.app.toml`, `AppProvider` z `embedded` w `app.jsx`, `useAppBridge()` w widokach.

### Stylizacja Polaris
- Aplikacja używa **Polaris Web Components** i `@shopify/shopify-app-react-router` (nawigacja, layout). Przed wysłaniem do recenzji sprawdź, czy wszystkie ekrany są czytelne i spójne z wytycznymi Polaris.

### GDPR – webhooki compliance (wymagane)
- **Zaimplementowane**:
  - `customers/data_request` → `webhooks.compliance.customers.data_request.jsx` (200, brak danych per-customer w DB).
  - `customers/redact` → `webhooks.compliance.customers.redact.jsx` (200, brak danych per-customer).
  - `shop/redact` → `webhooks.compliance.shop.redact.jsx` (200, usuwa wszystkie dane sklepu z bazy).
- Subskrypcje w `shopify.app.toml` w sekcji `[[webhooks.subscriptions]]` z `compliance_topics`.
- Odpowiedź **200** na każdy webhook; przy błędnym HMAC zwracany jest **401** przez `authenticate.webhook()`.

### Prędkość i wpływ na admin
- Nie ładuj ciężkich operacji synchronicznie w pierwszym ekranie; sync jest uruchamiany przyciskiem. Nie dodawaj skryptów na froncie sklepu bez potrzeby.

---

## 3. Proces publikacji

1. **App Listing** w Partner Dashboard: opis, zrzuty ekranu, film demonstracyjny.
2. **OAuth**: poprawne adresy URL (App URL, Redirection URLs), **HTTPS**.
3. **Submit for review** – recenzja zwykle 2–10 dni; często zwrot z drobnymi uwagami – popraw i wyślij ponownie.
4. **Testowanie webhooków**: `shopify webhook trigger` (np. compliance) – upewnij się, że endpointy zwracają 200.

---

## 4. Marketing / ASO

- **Słowa kluczowe** w tytule i krótkim opisie (np. rabaty, ROI, rentowność, discount analytics).
- **Darmowy okres**: 14 dni trial jest już w konfiguracji billing.
- **Built for Shopify**: spełnienie wymagań wydajności i jakości zwiększa szansę na promocję w wynikach wyszukiwania.

---

## 5. Szybka lista kontrolna

| Element | Status |
|--------|--------|
| Billing (recurring + trial) | ✅ W kodzie |
| GDPR: customers/data_request | ✅ |
| GDPR: customers/redact | ✅ |
| GDPR: shop/redact | ✅ |
| Embedded + App Bridge | ✅ |
| application_url / redirect_urls | ⚠️ Ustaw przed deploy |
| isTest wyłączone w produkcji | ✅ (NODE_ENV) |
| Testy (`npm run test`) | ✅ Uruchom przed submit |

Po uzupełnieniu URL-i i ostatnich punktów z sekcji „Do zrobienia” aplikacja jest gotowa do **Submit for review**.
