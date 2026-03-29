# Data Refinery - Dokumentacja Techniczna

## 1. Przegląd

Data Refinery to serwis przetwarzania plików z wbudowanym systemem walidacji bezpieczeństwa i transformacji danych. Obsługuje dokumenty tekstowe (PDF, TXT, MD, CSV) oraz pliki graficzne (JPG, PNG, SVG) ze zdolnością do redakcji wrażliwych informacji (PII) i usuwania metadanych.

Architektura: Node.js Express backend na porcie 4000, React TypeScript frontend na porcie 5173. Przetwarzanie asynchroniczne ze stanem persistowanym w plikach JSON. Szczególny nacisk na bezpieczeństwo z wielowarstwową walidacją.

## 2. Architektura

### Przepływ danych

```
HTTP Request (multipart/form-data)
    ↓
API Gateway (Express)
    ↓
Job Manager
    ↓
Sequential Processing:
  ├─ File Validator
  ├─ Security Checker
  ├─ Content Extractor
  ├─ PII Redactor
  ├─ Image Processor
  └─ SVG Sanitizer
    ↓
Export Assembly
    ↓
JSON Response
```

### Struktura katalogów

**Backend**:
```
backend/
├── index.js                    Express server
├── modules/
│   ├── extractors/
│   │   ├── fileValidator.js    magic bytes, MIME
│   │   ├── securityChecker.js  XSS, SQL, polyglot
│   │   ├── textExtractor.js    PDF, CSV, TXT, MD
│   │   ├── imageProcessor.js   metadata removal
│   │   └── svgSanitizer.js     XSS prevention
│   └── jobs/
│       ├── jobManager.js       job lifecycle
│       └── piiRedactor.js      PII detection
├── __tests__/                  138 unit tests
├── jobs/                       job state storage
├── uploads/                    temp files
├── Dockerfile
├── package.json
└── package-lock.json
```

**Frontend**:
```
frontend/
├── src/
│   ├── App.tsx                 main component
│   ├── main.tsx                entry point
│   ├── App.css                 styles
│   ├── index.css               base styles
│   └── components/             UI components
├── public/                     static assets
├── index.html
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
├── package.json
└── package-lock.json
```

## 3. Komponenty systemu

### 3.1 File Validator

Wstępna walidacja i klasyfikacja pliku.

**Proces**:
1. Odczyt pierwszych 4096 bajtów
2. Dopasowanie sygnatury magicznej
3. Porównanie z deklarowanym rozszerzeniem
4. Wnioskowanie typu MIME
5. Weryfikacja limitu rozmiaru (50MB)

**Wspierane formaty**:
- PDF: 0x25504446
- JPEG: 0xFFD8FFE0, 0xFFD8FFE1
- PNG: 0x89504E47
- SVG: XML signature
- TXT, MD, CSV: Text-based

**Detektuje**: Spoofing rozszerzenia, double extension, rozmiar powyżej limitu.

### 3.2 Security Checker

Wielowarstwowe wykrywanie zagrożeń bezpieczeństwa.

| Zagrożenie | Kod | Severity |
|-----------|-----|----------|
| XSS | XSS_PAYLOAD | CRITICAL |
| SQL Injection | INJECTION_PATTERN | HIGH |
| Polyglot | POLYGLOT_FILE | CRITICAL |
| Double extension | DOUBLE_EXTENSION | HIGH |

### 3.3 Text Extractor

Ekstrakcja zawartości z różnych formatów.

Wspiera: PDF, CSV, TXT, MD, SVG

Czyszczenie szumu: newline normalizacja, whitespace, control chars.

### 3.4 PII Redactor

Detekcja i maskowanie danych wrażliwych.

**Obsługiwane wzorce**:
- EMAIL: user@gmail.com
- PHONE: +48 12 345 67 89, (12) 345 67 89
- SSN: 123-45-6789
- CREDIT_CARD: 4532-1234-5678-9010
- IP_ADDRESS: 192.168.1.1
- API_KEY: sk_live_abc123...
- PASSWORD: password="value"
- PRIVATE_KEY: PEM format

### 3.5 Image Processor

Usuwanie metadanych i normalizacja obrazów.

Metadane: EXIF, IPTC, XMP

Normalizacja: max 2000px, quality 85-95, aspect ratio zachowany.

### 3.6 SVG Sanitizer

XSS prevention w plikach SVG.

Usuwa: `<script>`, `<metadata>`, `<iframe>`, event handlers, `javascript:` protocol.

Zachowuje: `<circle>`, `<rect>`, `<path>`, `<polygon>`, safe attributes.

### 3.7 Job Manager

Cykl życia job'a, persistencja, agregacja wyników.

Status flow: pending → processing → completed/failed

Persistencja: JSON files w `/backend/jobs/`. Auto-cleanup po 7 dniach.

## 4. API

**Adres bazowy**: `http://localhost:4000/api/v1`

### POST /jobs
Przesłanie plików do przetwarzania.

Request: multipart/form-data, plik `files` (1-100 plików, max 50MB każdy)

Response (201): `{ jobId, status, totalFiles }`

### GET /jobs/{jobId}
Status i postęp przetwarzania.

Response (200): Job status z per-file progress.

### GET /jobs/{jobId}/export
Pełny raport JSON.

Response: JSON object z export schema.

### PUT /jobs/{jobId}/annotation
Notatka operatora.

Request: `{ fileIndex, annotation }`

### GET /health
Health check.

Pełna specyfikacja: `openapi.yaml` + Swagger UI na `/docs`.

## 5. Testy

**Pokrycie**: 138 testów, 77.2% code coverage.

| Moduł | Testy | Coverage |
|-------|-------|----------|
| fileValidator | 20 | 84.81% |
| securityChecker | 20 | 92.45% |
| piiRedactor | 15 | 75.6% |
| textExtractor | 9 | 48.43% |
| imageProcessor | 20 | 74.83% |
| svgSanitizer | 20 | 96.77% |
| jobManager | 34 | 85.41% |

**Uruchomienie**:
```bash
npm test                        # All with coverage
npm run test:watch            # Watch mode
npm test fileValidator        # Specific file
```

## 6. Bezpieczeństwo

### Warstwy obrony

1. Request validation
2. File classification (magic bytes)
3. Content analysis (pattern matching)
4. Sanitization (XSS removal, metadata stripping, PII masking)
5. Export verification

### Przykłady ataków

**Double extension**:
```
Input: malware.exe.jpg
Magic byte: 0xFFD8FF = JPEG ✓
Security pattern: double_extension ✗
Result: REJECTED
```

**XSS w SVG**:
```
Input: <svg><script>alert(1)</script></svg>
Output: <svg></svg>
Issue: XSS_PAYLOAD logged
```

**Polyglot**:
```
Input: image.jpg z MZ header
Result: POLYGLOT_FILE code
```

## 7. Performance

**Czasy operacji** (per plik):
- Walidacja: 10-50ms
- Security scan: 5-20ms
- Ekstrakcja: 20-100ms
- PII redakcja: 30-150ms
- Image processing: 50-300ms
- SVG sanitization: 10-50ms

**Batch** (10 plików): ~1-3 sekund.

**Pamięć**:
- Per plik: ~1-5MB
- Job state: ~100KB
- Total heap: ~150-200MB

## 8. Wdrażanie

### Development
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

### Docker
```bash
docker-compose up
```

### Production
Wymaga: Database, Job queue, File storage, Rate limiting, Auth.

## 9. Standardy kodowania

- Brak komentarzy (self-documenting code)
- English identifiers
- 2 spaces formatting
- ESLint Standard
- ASCII only (bez Cyrillic)

## 10. Rozszerzenie systemu

Dodanie nowego formatu:
1. Magic byte w fileValidator.js
2. Security patterns w securityChecker.js
3. Extractor w textExtractor.js
4. Test cases (20+)
5. OpenAPI update

## 11. Debugging

**Plik odrzucony**:
- Sprawdzić rzeczywisty typ (magic bytes)
- Sprawdzić extension match
- Limit 50MB

**PII nie zredakcjonowane**:
- Weryfikować regex pattern
- Encoding UTF-8
- Check before export

**Metadata obrazu**:
- `npm ls sharp`
- Format obsługiwany
- Uruchomić test
