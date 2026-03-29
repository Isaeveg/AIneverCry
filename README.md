# Data Refinery

Bezpieczny gateway do przetwarzania plików, który przekształca nieustrukturyzowane dane w czyste, ustandaryzowane wyjście. Weryfikuje pliki, redaguje PII, usuwa metadane i wykrywa zagrożenia bezpieczeństwa przed eksportem.

## Możliwości

- **Walidacja plików** – deteksja magicznych bajtów, weryfikacja typu MIME
- **Skanowanie bezpieczeństwa** – wykrywanie XSS, wzorce SQL injection, detekcja plików polimorficznych
- **Redakcja PII** – email, telefon, SSN, klucze API, hasła z śledzeniem zmian
- **Przetwarzanie obrazów** – usuwanie metadanych, normalizacja formatu, kompresja
- **Sanityzacja SVG** – usuwanie skryptów, handlery zdarzeń, czyszczenie metadanych
- **Ujednolicony eksport** – strukturalny JSON z pełnym śladem audytu

Obsługiwane formaty: PDF, TXT, MD, CSV, SVG, JPG, PNG

## Instalacja

### Backend

```bash
cd backend
npm install
node index.js
```

Serwer dostępny pod `http://localhost:4000`

Endpointy API:
- `POST /api/v1/jobs` – utworzenie zadania z plikami
- `GET /api/v1/jobs/:id` – sprawdzenie statusu
- `GET /api/v1/jobs/:id/export` – pobranie JSON
- `GET /api/v1/jobs` – lista zadań
- `GET /api/v1/health` – sprawdzenie stanu

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dostępny pod `http://localhost:5173`

### Docker

```bash
docker-compose up
```

## Stos technologiczny

**Backend**
- Node.js / Express
- Sharp (przetwarzanie obrazów)
- uuid (śledzenie zadań)

**Frontend**
- React 18 / TypeScript
- Vite
- TailwindCSS

**Testowanie**
- Testy jednostkowe, pokrycie 77%

**Dokumentacja**
- OpenAPI 3.0.3 / Swagger UI
