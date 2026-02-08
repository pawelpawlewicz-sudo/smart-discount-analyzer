# Webhooki – stan i testowanie

## Zarejestrowane i działające

| Topic | Plik handlera | Opis |
|-------|----------------|------|
| **app/uninstalled** | `webhooks.app.uninstalled.jsx` | Usunięcie sesji sklepu z bazy. Zwraca 200. |
| **app/scopes_update** | `webhooks.app.scopes_update.jsx` | Aktualizacja scopów w sesji. Zwraca 200. ✅ (potwierdzone w logach) |
| **products/update** | `webhooks.products.update.jsx` | Aktualizacja ceny/tytułu produktu w `ProductDiscountPerformance`. Zwraca 200/500. |
| **customers/data_request** | `webhooks.compliance.customers.data_request.jsx` | GDPR – nie przechowujemy danych per customer. Zwraca 200. |
| **customers/redact** | `webhooks.compliance.customers.redact.jsx` | GDPR – brak danych do usunięcia. Zwraca 200. |
| **shop/redact** | `webhooks.compliance.shop.redact.jsx` | GDPR – po odinstalowaniu usuwa dane sklepu. Zwraca 200. |

Wszystkie używają `authenticate.webhook(request)` i zwracają `Response` z odpowiednim statusem.

## Wyłączone celowo (orders)

W `shopify.app.toml` subskrypcje **orders/create** i **orders/updated** są zakomentowane, bo:

- Wymagają **zatwierdzenia dostępu do chronionych danych klienta** (protected customer data) przez Shopify.
- W dev i przed zatwierdzeniem aplikacja korzysta z **pollingu** (sync z Dashboardu), zamiast webhooków zamówień.

Handlery istnieją i są gotowe:

- `webhooks.orders.create.jsx` – analiza rabatu przy nowym zamówieniu.
- `webhooks.orders.updated.jsx` – aktualizacja przy zmianie/zwrocie.

**Aby włączyć po zatwierdzeniu App Store:**

1. W `shopify.app.toml` odkomentuj blok:

```toml
  [[webhooks.subscriptions]]
  topics = [ "orders/create" ]
  uri = "/webhooks/orders/create"

  [[webhooks.subscriptions]]
  topics = [ "orders/updated" ]
  uri = "/webhooks/orders/updated"
```

2. W Partner Dashboard zgłoś aplikację do recenzji; przy żądaniu dostępu do zamówień (protected customer data) opisz uzasadnienie.
3. Po zatwierdzeniu zrób deploy (np. push na main) – Shopify zarejestruje nowe webhooki.

## Jak przetestować

- **app/scopes_update** – zmiana uprawnień w Partner Dashboard lub przy instalacji; sprawdź logi (Response 200).
- **products/update** – w sklepie testowym zmień cenę lub tytuł produktu; w logach serwera powinien pojawić się `Received products/update webhook`.
- **app/uninstalled** – odinstaluj aplikację ze sklepu testowego (potem zainstaluj ponownie); w bazie powinny zniknąć sesje dla tego sklepu.
- **Compliance** – wywoływane przez Shopify przy żądaniach GDPR; zwykle nie testuje się ich ręcznie.

Logi webhooków w Shopify: **Partner Dashboard** → Twoja aplikacja → **Webhooks** (lub **Event subscription** / logi dostaw).
