# Gdzie jest Dashboard i przycisk „Sync data”

## 1. Jak wejść w aplikację (Dashboard)

1. Zaloguj się do **Shopify Admin** sklepu (np. `testowy-sklep-8322.myshopify.com/admin`).
2. W **lewym menu** kliknij **Aplikacje** (Apps).
3. Otwórz **Smart Discount Analyzer** (Discount Intelligence).
4. Otworzy się **embedded app** – to jest Twoja aplikacja wewnątrz panelu Shopify.

**Dashboard aplikacji** = pierwszy widok po wejściu w aplikację. Adres w pasku przeglądarki będzie miał ścieżkę typu `.../apps/nazwa-aplikacji` lub w iframe `.../app`.

---

## 2. Pierwszy ekran: subskrypcja (billing)

Przy pierwszym wejściu aplikacja może pokazać **ekran subskrypcji** (plan płatny, 14‑dniowy trial). To normalne.

- Kliknij **Rozpocznij okres próbny** / **Start trial** (albo **Approve** w trybie testowym).
- Po zatwierdzeniu zobaczysz **główny widok** – to jest **Dashboard**.

Dopóki nie zaakceptujesz planu/trialu, nie zobaczysz Dashboardu z przyciskiem „Sync data”.

---

## 3. Gdzie jest przycisk „Sync data”

- **Strona:** **Dashboard** (główna strona aplikacji).
- **Nawigacja:** Po lewej stronie (sidebar) są linki:
  - **Dashboard** ← tu musisz być
  - Historia rabatów (Discount history)
  - Rekomendacje (Recommendations)
  - Ustawienia (Settings)

Jeśli jesteś na **Historia rabatów**, **Rekomendacje** albo **Ustawienia** – przycisku „Sync data” tam **nie ma**. Jest tylko na **Dashboard**.

- Na **Dashboard** na górze strony (w szarym bloku z ikoną i tekstem „Discounts that pay off”) są dwa przyciski:
  1. **Sync data** (główny, zielony) – uruchamia synchronizację zamówień i rabatów.
  2. **Generuj rekomendacje** (link) – prowadzi do strony Rekomendacje.

Jeśli nadal nie widzisz przycisku:
- Kliknij w menu po lewej **Dashboard**, żeby wrócić na stronę główną.
- Odśwież stronę (F5).
- Sprawdź, czy w konsoli przeglądarki (F12 → Console) nie ma błędów JS.

---

## 4. Skąd „nikt nie pytał o zatwierdzenie danych”

Aplikacja **nie pyta** Ciebie osobiście o zatwierdzenie danych. Chodzi o to, że:

- **Webhooki `orders/create` i `orders/updated`** w Shopify wymagają **zatwierdzenia dostępu do chronionych danych** (protected customer data) **przez Shopify** (recenzja aplikacji), a nie przez Ciebie w panelu.
- Dopóki aplikacja nie przejdzie recenzji i nie dostanie tego zatwierdzenia, te webhooki są **wyłączone** w konfiguracji (`shopify.app.toml`).
- Zamiast nich aplikacja używa **pollingu**: przycisk **Sync data** na Dashboardzie wysyła zapytania do API Shopify (zamówienia, rabaty) i na tej podstawie uzupełnia dane. Do tego **nie** jest potrzebne osobne „zatwierdzenie danych” – wystarczy, że aplikacja ma uprawnienia (scopes) do odczytu zamówień i rabatów, które nadałeś przy instalacji.

Podsumowując: **Sync data** = ręczne (polling) pobranie danych przez API. **Nie** musisz nic dodatkowo zatwierdzać w ustawieniach – jeśli widzisz Dashboard i przycisk „Sync data”, możesz od razu z niego skorzystać.
