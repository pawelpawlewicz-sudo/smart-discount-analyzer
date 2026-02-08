# Weryfikacja działania i kolejne kroki

Po ustawieniu Railway, zmiennych i Partner Dashboard – jak sprawdzić, że wszystko działa, i co dalej.

---

## 1. Sprawdzenie, że aplikacja działa

### A) Railway – usługa działa

- W Railway → usługa **smart-discount-analyzer** → **Deployments**.
- Ostatni deployment ma status **Success** / **Active** (nie Crashed).
- W **Settings** → **Networking** masz wygenerowaną domenę (np. `https://discountintelligence.up.railway.app`).

### B) Strona główna i polityka prywatności

W przeglądarce (bez logowania):

| URL | Oczekiwany efekt |
|-----|------------------|
| `https://discountintelligence.up.railway.app` | Przekierowanie do Shopify (logowanie) lub strona „Install app” / błąd 404 – **to jest OK**; główny URL bez `/app` może nie serwować HTML. |
| `https://discountintelligence.up.railway.app/app` | **Albo** formularz instalacji („Install app” dla sklepu), **albo** po zalogowaniu – dashboard aplikacji. |
| `https://discountintelligence.up.railway.app/privacy.html` | Strona polityki prywatności (EN/PL/ES/DE). |

Jeśli `/app` pokazuje stronę instalacji lub prosi o wybór sklepu – backend i URL działają.

### C) Instalacja na sklepie testowym (najważniejszy test)

1. W **Shopify Partner Dashboard** → Twoja aplikacja → **Test your app** (lub **Select store** → wybierz sklep deweloperski).
2. Zostaniesz przekierowany na `https://discountintelligence.up.railway.app/...` i przez OAuth do Shopify.
3. Po zatwierdzeniu uprawnień otwiera się **embedded app** (Dashboard Discount Intelligence wewnątrz panelu Shopify).
4. W aplikacji: **Sync data** → po chwili pojawią się dane (lub puste listy, jeśli sklep nie ma zamówień/rabatów). **Recommendations**, **Discount history**, **Settings** – wszystko ładuje się bez błędów.

Jeśli cały ten flow przejdzie, **produkcja działa poprawnie**.

### D) Partner Dashboard – konfiguracja URL

W **Partners** → Twoja aplikacja → **App setup** (lub **Configuration**):

- **App URL**: `https://discountintelligence.up.railway.app/app`
- **Allowed redirection URL(s)** zawiera: `https://discountintelligence.up.railway.app/api/auth`

Bez tego OAuth się nie uda.

---

## 2. Kolejne kroki (przed wysłaniem do recenzji)

| # | Zadanie | Gdzie |
|---|---------|--------|
| 1 | **App Listing** – nazwa, krótki i długi opis, zrzuty ekranu (min. 1, najlepiej 3–5 z `presentation/screens/`) | Partner Dashboard → Apps → [Twoja app] → App listing |
| 2 | **Support email** – wpisać prawdziwy adres (np. support@twojadomena.pl) | App listing + ewentualnie w `public/privacy.html` |
| 3 | **Privacy policy URL** – podać link do polityki. Możesz użyć: `https://discountintelligence.up.railway.app/privacy.html` | App listing → Privacy policy URL |
| 4 | **Pricing** – w kodzie jest plan 9,99 USD / 30 dni, 14 dni trial. W Dashboard upewnij się, że **App pricing** / **Billing** jest skonfigurowane zgodnie z listingiem | Partner Dashboard → Twoja app → Billing / Pricing |
| 5 | **Submit for review** – gdy listing jest kompletny (opis, zrzuty, support email, privacy URL), wyślij aplikację do recenzji | Partner Dashboard → **Submit app** / **Submit for review** |

Recenzja zwykle trwa **2–10 dni**. Często dostaniesz uwagi – poprawiasz i wysyłasz ponownie.

---

## 3. Szybka checklista „czy mogę wysłać do recenzji”

- [ ] Railway: deployment **Success**, aplikacja nie crashuje.
- [ ] Test na sklepie: **Install app** → OAuth → Dashboard → Sync → Recommendations / Discounts działają.
- [ ] Partner Dashboard: **App URL** = `.../app`, **Redirect** = `.../api/auth`.
- [ ] App listing: nazwa, opis, min. 1 zrzut, **Support email**, **Privacy policy URL**.
- [ ] Polityka prywatności dostępna pod podanym URL (np. `/privacy.html`).

Jeśli wszystkie punkty są zaznaczone – możesz klikać **Submit for review**.
