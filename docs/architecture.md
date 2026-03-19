# ARTWEB — Архитектура MVP-платформы

Версия: 1.1 (ревизия)
Дата: 2026-03-20
Статус: утверждена для реализации

---

## Changelog v1.0 → v1.1

| # | Что изменено | Причина |
|---|---|---|
| 1 | Модель доступа: subscription-first → access-first | Основная логика — покупка/выдача доступа, не подписка |
| 2 | Новая access model с 6 сценариями | Полное описание всех путей получения доступа |
| 3 | Auth: разделены middleware / server-side auth / CSRF | Middleware не единственный источник авторизации |
| 4 | Storage: корректный flow X-Accel-Redirect + signed URL | Убрано противоречие client → internal location |
| 5 | Вебинары: зафиксированы риски embed для VOD | Embed допустим для live, не для платного VOD |
| 6 | Автовебинары: запрет перемотки = UI/UX, не security | Честная формулировка ограничений |
| 7 | Новый модуль PAYMENT (domain boundary) | Покупки отделены от тарифного модуля |
| 8 | Новый модуль AUDIT (cross-cutting) | Логирование действий администратора |
| 9 | AI: source-grounded ответы, chunk references | Контроль галлюцинаций, прозрачность источников |
| 10 | Process topology: web / ws / worker раздельно | Cron не привязан к WS-серверу |

---

## 1. Высокоуровневая архитектурная схема

```
                        +------------------+
                        |   Пользователь   |
                        |  (Браузер, ПК)   |
                        +--------+---------+
                                 |
                            HTTPS (443)
                                 |
                        +--------v---------+
                        |      nginx       |
                        |  reverse proxy   |
                        |  + SSL termination|
                        |  + static files  |
                        |  + X-Accel-Redirect|
                        |  + secure_link   |
                        +--------+---------+
                                 |
                    +------------+-------------------+
                    |            |                    |
           +--------v-------+  +v-----------+  +----v-----------+
           |  Next.js App   |  |  WS Server |  |    Worker      |
           |  (Port 3003)   |  | (Port 3004)|  |  (no port)     |
           |                |  |            |  |                |
           | - SSR/SSG      |  | - Chat     |  | - Cron jobs    |
           | - API Routes   |  | - Notif.   |  | - Reminders    |
           | - Auth         |  | - Events   |  | - Cleanup      |
           +----+----+-----+  +-----+------+  | - AI indexing  |
                |    |               |          +-------+--------+
    +-----------+    +--------+      |                  |
    |                         |      |                  |
+---v--------+         +-----v------+------------------+
| PostgreSQL |         | File Storage |
| (Port 5432)|         | /storage/    |
|            |         | via nginx    |
| - 32+ tables|        +--------------+
| - pgvector |
| - pg_trgm  |    +------------------------+
| - FTS      |    |   External Services     |
+---+--------+    |                         |
    |              | - LLM API (Claude)      |
    +--------------+ - SMTP / Email          |
                   | - Telegram Bot API      |
                   | - Stream source         |
                   |   (YouTube/Vimeo)       |
                   +-------------------------+
```

## 2. Frontend Architecture

### Стек
| Технология | Почему |
|---|---|
| Next.js 16 (App Router) | SSR + API в одном, SEO, файловый роутинг |
| TypeScript | Типобезопасность, рефакторинг, DX |
| Tailwind CSS | Быстрая стилизация, desktop-first, нет vendor lock-in |
| React Hook Form + Zod | Формы с валидацией на клиенте и сервере |
| SWR | Серверный стейт, кэширование, ревалидация |

### Принципы
- **Server Components по умолчанию** — клиентские только где нужна интерактивность
- **Desktop-first** — точки останова: 1280px → 1024px → 768px → 375px
- **Язык интерфейса:** русский, строки через константы (подготовка к i18n)
- **Без тяжёлых UI-фреймворков** — собственные компоненты на Tailwind

### Структура маршрутов (App Router)
```
src/app/
├── (auth)/                    # Группа: неавторизованные
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   ├── reset-password/
│   └── verify-email/
├── (student)/                 # Группа: кабинет студента
│   ├── dashboard/
│   ├── courses/
│   │   └── [courseSlug]/
│   │       └── [lessonSlug]/
│   ├── knowledge-base/
│   ├── webinars/
│   │   └── [webinarSlug]/
│   ├── auto-webinars/
│   ├── assignments/
│   ├── ai-chat/
│   ├── partner/
│   ├── notifications/
│   └── profile/
├── (admin)/                   # Группа: админка
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── courses/
│   │   ├── tariffs/
│   │   ├── webinars/
│   │   ├── auto-webinars/
│   │   ├── knowledge-base/
│   │   ├── assignments/
│   │   ├── promo-codes/
│   │   ├── partners/
│   │   ├── payments/
│   │   ├── audit-log/
│   │   └── settings/
└── api/                       # API Routes
```

### Layouts
```
RootLayout (html, шрифты, metadata)
├── AuthLayout (минимальный, центрированная форма)
├── StudentLayout (sidebar, header, notifications)
└── AdminLayout (sidebar навигация, breadcrumbs)
```

## 3. Backend Architecture

### Стек
| Технология | Почему |
|---|---|
| Next.js API Routes | Единый деплой с фронтом, меньше инфраструктуры |
| Prisma 7 + PrismaPg | Типобезопасный ORM, миграции, генерация клиента |
| PostgreSQL 16 | Проверенная РСУБД, FTS, pgvector, JSON, массивы |
| jose | JWT-операции (Edge-совместимая библиотека) |
| bcryptjs | Хеширование паролей |
| Zod | Валидация входных данных на сервере |
| ws | WebSocket-сервер для реального времени |

### Принципы
- **API Routes** для всех CRUD-операций и бизнес-логики
- **Middleware** (Next.js) — только page protection, redirect, базовая фильтрация
- **Server-side auth utility** (`lib/auth.ts`) — для route handlers и services
- **Service Layer** — бизнес-логика отделена от route handlers
- **Отдельный WS-процесс** для вебинарного чата и real-time уведомлений
- **Отдельный Worker-процесс** для cron-задач и фоновых операций

### Структура серверного кода
```
src/
├── app/api/                   # Route Handlers (HTTP endpoints)
│   ├── auth/
│   ├── users/
│   ├── courses/
│   ├── assignments/
│   ├── knowledge-base/
│   ├── webinars/
│   ├── auto-webinars/
│   ├── ai/
│   ├── notifications/
│   ├── partners/
│   ├── tariffs/
│   ├── payments/
│   ├── promo-codes/
│   ├── files/
│   └── admin/
├── lib/                       # Shared utilities
│   ├── prisma.ts
│   ├── auth.ts                # Server-side auth: getAuthUser(), requireAuth(), requireAdmin()
│   ├── access.ts              # Access checking: checkCourseAccess(), checkResourceAccess()
│   ├── csrf.ts                # CSRF token validation
│   ├── permissions.ts
│   ├── validation.ts
│   ├── storage.ts
│   ├── email.ts
│   ├── telegram.ts
│   └── ai.ts
├── services/                  # Business logic layer
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── course.service.ts
│   ├── access.service.ts      # Access grant/revoke logic
│   ├── payment.service.ts     # Purchase/billing logic
│   ├── assignment.service.ts
│   ├── webinar.service.ts
│   ├── auto-webinar.service.ts
│   ├── ai.service.ts
│   ├── notification.service.ts
│   ├── partner.service.ts
│   ├── tariff.service.ts
│   ├── audit.service.ts       # Audit logging
│   └── storage.service.ts
├── middleware.ts              # Next.js middleware (page protection, redirects)
├── ws-server.ts               # WebSocket server (отдельный процесс)
└── worker.ts                  # Cron / background jobs (отдельный процесс)
```

## 4. Модули системы

### 4.1 AUTH — Аутентификация и авторизация
**Ответственность:** регистрация, логин, токены, сессии, восстановление пароля, подтверждение email
**Границы:** не знает о тарифах, курсах, контенте. Только identity.
**Зависит от:** User (хранение), Notification (отправка писем), Security (логирование)
**Потребители:** все модули (через server-side auth utility)

### 4.2 USER — Пользователи
**Ответственность:** профиль, аватар, настройки, список пользователей (для админа)
**Границы:** не управляет доступами (это Access). Только данные пользователя.
**Зависит от:** Auth (identity), Storage (аватар)
**Потребители:** Admin, Partner, все UI

### 4.3 TARIFF — Тарифы и конфигурация доступа
**Ответственность:** определение тарифов, привязка тарифа к курсам/ресурсам, ценообразование, промокоды
**Границы:** описывает "какой тариф даёт доступ к чему". Не управляет покупками (это Payment). Не выдаёт доступ напрямую (это Access).
**Зависит от:** Course (привязка курсов к тарифу)
**Потребители:** Payment (при покупке тарифа), Access (при выдаче доступа), Admin (конструктор тарифов)

### 4.4 ACCESS — Управление доступом (НОВЫЙ, выделен из TARIFF)
**Ответственность:** выдача, проверка и отзыв доступа к ресурсам (курсы, база знаний, AI чат)
**Границы:** не знает о платежах. Получает команду "выдать доступ" от Payment или Admin. Проверяет "есть ли у пользователя право на ресурс".
**Зависит от:** User, Tariff (конфигурация тарифа)
**Потребители:** Course, KnowledgeBase, Webinar, AutoWebinar, AI (запрашивают проверку доступа)

### 4.5 COURSE — Курсы и обучение
**Ответственность:** курсы, модули, уроки, файлы, чек-листы, прогресс
**Границы:** не проверяет оплату (делегирует Access). Не проверяет задания (делегирует Assignment).
**Зависит от:** Access (проверка доступа), Storage (видео, файлы), Assignment (задания к урокам)
**Потребители:** AI (контекст для чата), Admin (конструктор курсов)

### 4.6 ASSIGNMENT — Задания и тесты
**Ответственность:** создание заданий, приём ответов, тесты, автопроверка тестов, очередь на проверку
**Границы:** не оценивает через ИИ сам (делегирует AI). Не отправляет уведомления (делегирует Notification).
**Зависит от:** Course (привязка к уроку), AI (предпроверка), Storage (загрузка файлов), Notification (результат проверки)
**Потребители:** Admin (проверка заданий), Student (мои задания)

### 4.7 KNOWLEDGE BASE — База знаний
**Ответственность:** документы, шаблоны, записи вебинаров, категоризация, поиск
**Границы:** только чтение для студентов. Создание — только админ.
**Зависит от:** Access (проверка доступа), Storage (файлы), AI (контекст для RAG)
**Потребители:** AI (источник знаний для RAG), Student, Admin

### 4.8 WEBINAR — Живые вебинары
**Ответственность:** расписание, доступ, встраивание стрима, чат, посещаемость, запись
**Границы:** не является стриминговым сервером. Управляет метаданными и доступом.
**Зависит от:** Access (доступ), Notification (напоминания), WS-Server (чат), Storage (запись)
**Потребители:** Student, Admin, Notification

### 4.9 AUTO-WEBINAR — Автовебинары
**Ответственность:** расписание показов, воспроизведение записей по расписанию, материалы после просмотра
**Границы:** не стримит. Управляет показом готового видео по расписанию.
**Зависит от:** Access (доступ), Notification (напоминания), Storage (видео)
**Потребители:** Student, Admin, Notification

### 4.10 AI — Искусственный интеллект
**Ответственность:** чат-помощник, RAG по материалам, предпроверка заданий, лимиты запросов, source-grounded ответы
**Границы:** работает ТОЛЬКО по внутренним материалам. Не имеет доступа к внешнему интернету. Обязан ссылаться на источники. Если контекст не найден — явно сообщает, что ответа в материалах нет.
**Зависит от:** Course (контент курсов), KnowledgeBase (документы), Assignment (задание + ответ для проверки), Access (проверка права на AI)
**Потребители:** Student (чат), Assignment (предпроверка), Admin (просмотр ИИ-оценок)

### 4.11 NOTIFICATION — Уведомления
**Ответственность:** создание, отправка, доставка по каналам (in-app, email, Telegram), напоминания
**Границы:** не генерирует контент уведомлений. Получает готовый payload от других модулей.
**Зависит от:** User (получатель), Telegram (интеграция), Email (SMTP)
**Потребители:** все модули (триггерят уведомления)

### 4.12 PARTNER — Партнёрская система
**Ответственность:** статус партнёра, реферальные ссылки, учёт регистраций/покупок, комиссии, выплаты
**Границы:** не управляет тарифами. Только отслеживает и начисляет.
**Зависит от:** User (реферал → регистрация), Payment (покупка → начисление комиссии)
**Потребители:** Student (кабинет партнёра), Admin (управление партнёрами)

### 4.13 ADMIN — Админка
**Ответственность:** UI для управления всеми сущностями, дашборд с метриками
**Границы:** не содержит бизнес-логики. Вызывает API других модулей.
**Зависит от:** все модули (через API)
**Потребители:** только пользователи с ролью ADMIN

### 4.14 STORAGE — Файловое хранилище
**Ответственность:** загрузка, хранение, защищённая выдача файлов и видео
**Границы:** не знает о бизнес-логике. Только CRUD файлов + выдача через nginx (X-Accel-Redirect для скачивания, secure_link для потокового воспроизведения).
**Зависит от:** nginx (X-Accel-Redirect, secure_link module)
**Потребители:** Course, Assignment, KnowledgeBase, Webinar, AutoWebinar, User

### 4.15 SECURITY — Безопасность
**Ответственность:** логирование входов, контроль сессий, обнаружение подозрительной активности, rate limiting
**Границы:** наблюдает и ограничивает. Не принимает бизнес-решений.
**Зависит от:** Auth (события входа), Session (управление)
**Потребители:** Auth, Admin (просмотр логов)

### 4.16 PAYMENT — Покупки и биллинг (НОВЫЙ)
**Ответственность:** регистрация покупок, хранение платёжных записей, интеграция с платёжной системой (будущее), ручное подтверждение оплаты (MVP)
**Границы:** знает о факте оплаты, не знает о содержании курсов. После успешной покупки вызывает Access для выдачи доступа, Partner для начисления комиссии.
**Зависит от:** User, Tariff (цена, состав), Access (выдача доступа после оплаты), Partner (комиссия)
**Потребители:** Admin (управление покупками, ручное подтверждение), Student (мои покупки)

**Сущности Payment:**
- **Purchase** — факт покупки (userId, type: COURSE|TARIFF, targetId, amount, status: PENDING|CONFIRMED|CANCELLED, paymentMethod: MANUAL|CARD|INVOICE, confirmedBy, confirmedAt)
- **BillingRecord** — запись для отчётности (purchaseId, amount, description, createdAt)

**MVP-подход:** в MVP платежи подтверждаются администратором вручную (пользователь оплачивает по реквизитам, админ подтверждает в панели). Платёжный шлюз подключается на следующем этапе, но domain boundary уже заложен.

### 4.17 AUDIT — Аудит действий (НОВЫЙ, cross-cutting)
**Ответственность:** логирование всех значимых действий администраторов и системы
**Границы:** только запись и чтение логов. Не принимает решений, не блокирует операции.
**Зависит от:** Auth (кто выполнил действие)
**Потребители:** Admin (просмотр аудит-лога)

**Отличие от SecurityLog:**
- **SecurityLog** — события безопасности (входы, попытки взлома, rate limit)
- **AuditLog** — бизнес-действия (кто что изменил)

**Логируемые действия:**
| Действие | actor | target | details |
|---|---|---|---|
| Выдача доступа | adminId | userId + courseId | grantType, reason |
| Отзыв доступа | adminId | userId + courseId | reason |
| Изменение тарифа | adminId | tariffId | oldPrice, newPrice, changes |
| Проверка задания | adminId | submissionId | score, aiScore, override |
| Публикация курса | adminId | courseId | — |
| Скрытие курса | adminId | courseId | reason |
| Изменение вебинара | adminId | webinarId | changedFields |
| Подтверждение оплаты | adminId | purchaseId | amount, userId |
| Изменение роли пользователя | adminId | userId | oldRole, newRole |
| Применение промокода | system/adminId | promoCodeId + userId | discount |

**Сущность AuditLog:**
```
AuditLog {
  id, actorId, actorRole, action, targetType, targetId,
  details (JSON), ipAddress, createdAt
}
```

## 5. Карта зависимостей между модулями

```
AUTH ←──── все модули (через lib/auth.ts)
  │
  └──→ USER ──→ STORAGE (аватар)
  └──→ SECURITY (логи)
  └──→ NOTIFICATION (email верификация)

TARIFF ──→ COURSE (привязка курсов)
  ↑
  │
PAYMENT ──→ TARIFF (состав и цена)
        ──→ ACCESS (выдать доступ после покупки)
        ──→ PARTNER (начислить комиссию)
        ──→ AUDIT (лог покупки)

ACCESS ←── COURSE, KNOWLEDGE BASE, WEBINAR, AUTO-WEBINAR, AI (проверка доступа)
  │
  └──→ TARIFF (конфигурация "тариф → ресурсы")
  └──→ AUDIT (лог выдачи/отзыва)

COURSE ──→ ACCESS (доступ)
  │    ──→ STORAGE (видео, файлы)
  │    ──→ ASSIGNMENT (задания к урокам)
  │
  └──→ AI (контекст для RAG)

ASSIGNMENT ──→ AI (предпроверка)
           ──→ STORAGE (загрузка файлов)
           ──→ NOTIFICATION (результат проверки)
           ──→ AUDIT (проверка задания)

KNOWLEDGE BASE ──→ ACCESS (доступ)
               ──→ STORAGE (файлы)
               ──→ AI (источник для RAG)

WEBINAR ──→ ACCESS (доступ)
        ──→ NOTIFICATION (напоминания)
        ──→ STORAGE (запись)
        ──→ WS-SERVER (чат)

AUTO-WEBINAR ──→ ACCESS (доступ)
             ──→ NOTIFICATION (напоминания)
             ──→ STORAGE (видео)

AI ──→ COURSE + KNOWLEDGE BASE (RAG-контекст)
   ──→ ACCESS (проверка права на AI)
   ──→ LLM API (внешний)

NOTIFICATION ──→ EMAIL (SMTP)
             ──→ TELEGRAM BOT API
             ──→ WS-SERVER (in-app push)

ADMIN ──→ все модули (через API)
      ──→ AUDIT (все действия логируются)

AUDIT ←── ADMIN, PAYMENT, ACCESS, ASSIGNMENT (запись логов)
```

## 6. Auth Flow

### Регистрация
```
Клиент                    Сервер                      Email
  │                         │                           │
  │── POST /api/auth/register ─→│                       │
  │   {email, password,     │                           │
  │    firstName, lastName} │                           │
  │                         │── validate (Zod)          │
  │                         │── check email unique      │
  │                         │── hash password (bcrypt)  │
  │                         │── create User             │
  │                         │── create EmailToken       │
  │                         │── log SecurityLog         │
  │                         │──────────────────────────→│ send verification email
  │                         │                           │
  │←── 201 {message}  ─────│                           │
  │                         │                           │
  │   (пользователь кликает ссылку в письме)            │
  │                         │                           │
  │── GET /api/auth/verify-email?token=xxx ────────────→│
  │                         │── find token              │
  │                         │── check expiry            │
  │                         │── mark email verified     │
  │                         │── mark token used         │
  │←── redirect to /login ──│                           │
```

### Логин
```
Клиент                    Сервер
  │                         │
  │── POST /api/auth/login ─→│
  │   {email, password}     │
  │                         │── find user by email
  │                         │── verify password (bcrypt)
  │                         │── check isActive, emailVerified
  │                         │── check active sessions count (≤3)
  │                         │── create Session (refresh token)
  │                         │── sign JWT (15 min, contains: userId, role, isPartner)
  │                         │── log SecurityLog (ip, userAgent)
  │                         │
  │←── 200 ─────────────────│
  │   Set-Cookie: token (httpOnly, secure, sameSite=lax)
  │   Set-Cookie: refresh_token (httpOnly, secure, sameSite=lax, path=/api/auth)
  │   Body: {user: {id, email, firstName, lastName, role, isPartner}}
```

### Refresh
```
Клиент                    Сервер
  │                         │
  │── POST /api/auth/refresh ──→│
  │   Cookie: refresh_token │
  │                         │── find Session by refresh token
  │                         │── check expiry
  │                         │── generate new refresh token (rotation)
  │                         │── update Session
  │                         │── sign new JWT
  │                         │
  │←── 200 ─────────────────│
  │   Set-Cookie: token (new JWT)
  │   Set-Cookie: refresh_token (new, rotated)
```

### JWT Structure
```json
{
  "sub": "user-uuid",
  "role": "STUDENT",
  "isPartner": false,
  "iat": 1711900000,
  "exp": 1711900900
}
```

### Auth Architecture: три уровня (ИСПРАВЛЕНО)

**Уровень 1: Next.js Middleware (`middleware.ts`) — page protection и redirect**
```
Request → middleware.ts
  │
  ├── Public routes (/login, /register, /api/auth/*) → pass through
  │
  ├── Protected pages → extract JWT from cookie
  │     │
  │     ├── No token → redirect to /login
  │     ├── Token expired → redirect to /login (client-side refresh)
  │     ├── Token valid, role check:
  │     │     ├── /admin/* → role !== ADMIN → redirect /dashboard
  │     │     └── /student/* → pass through
  │     └── Token invalid → redirect to /login
  │
  └── API routes → pass through (auth handled by server-side utility)
```

**Middleware НЕ является источником авторизации для API.** Middleware работает на Edge Runtime, не имеет доступа к БД. Его задача — только redirect для страниц и базовая фильтрация.

**Уровень 2: Server-side Auth Utility (`lib/auth.ts`) — route handler авторизация**
```typescript
// lib/auth.ts — используется в каждом route handler

getAuthUser(request):
  1. Extract JWT from cookie
  2. Verify signature + expiry (jose)
  3. Return { userId, role, isPartner } или null

requireAuth(request):
  1. getAuthUser(request)
  2. Если null → throw 401 Unauthorized

requireAdmin(request):
  1. requireAuth(request)
  2. Если role !== ADMIN → throw 403 Forbidden

// Пример использования в route handler:
export async function POST(request: Request) {
  const user = await requireAuth(request);  // 401 если не авторизован
  // ... бизнес-логика
}
```

**Уровень 3: Service Layer — access и role validation**
```typescript
// services/access.service.ts
checkCourseAccess(userId, courseId):
  1. Найти AccessGrant для userId + COURSE + courseId
  2. Проверить expiresAt (null = бессрочно, или > now)
  3. Return true/false

checkResourceAccess(userId, resourceType, resourceId):
  // Универсальная проверка для любого типа ресурса
```

### CSRF Strategy (НОВОЕ)

**Проблема:** при cookie-based auth (httpOnly JWT) браузер автоматически отправляет cookie с каждым запросом. Атака CSRF может инициировать state-changing запросы от имени пользователя.

**Решение: Double Submit Cookie pattern**
```
Логин:
  Сервер → Set-Cookie: csrf_token (НЕ httpOnly, secure, sameSite=lax)
  Значение: random token, привязанный к сессии

State-changing запрос (POST, PATCH, DELETE):
  Клиент → читает csrf_token из cookie (JavaScript)
  Клиент → отправляет его в заголовке X-CSRF-Token
  Сервер → сравнивает cookie csrf_token с header X-CSRF-Token
  Если не совпадают → 403 Forbidden
```

**Почему Double Submit Cookie:**
- `sameSite=lax` уже блокирует большинство CSRF-атак на POST
- Double Submit — дополнительный слой защиты
- Не требует серверного хранения CSRF-токенов
- Совместим с SWR и fetch-based клиентом

**Какие запросы защищены:**
- Все POST, PATCH, PUT, DELETE к `/api/*`
- Исключения: `/api/auth/login`, `/api/auth/register` (нет cookie до логина)

## 7. Access Model (ПЕРЕРАБОТАНО)

### Базовая модель: Access-First

Главный принцип: доступ к ресурсу определяется наличием **AccessGrant** — записи в БД, подтверждающей право пользователя на ресурс. Подписочная модель (recurring billing) — возможное расширение, но не основа MVP.

```
Уровень 1: РОЛЬ (ADMIN / STUDENT)
  ↓
Уровень 2: СТАТУС ПАРТНЁРА (isPartner: true/false)
  ↓
Уровень 3: ДОСТУП (AccessGrant — конкретные ресурсы, к которым есть доступ)
  ↓
Уровень 4: БЕСПЛАТНЫЙ КОНТЕНТ (lesson.isFree, course.hasFreeLessons)
```

### Сущность AccessGrant
```
AccessGrant {
  id
  userId
  resourceType: COURSE | KNOWLEDGE_BASE | AI_CHAT | WEBINAR | AUTO_WEBINAR
  resourceId:   courseId | null (для глобальных ресурсов типа AI_CHAT)
  grantedVia:   PURCHASE | TARIFF | ADMIN_GRANT | PROMO_CODE
  sourceId:     purchaseId | tariffId | adminUserId | promoCodeId
  expiresAt:    null (бессрочно) | DateTime
  isActive:     true/false (для ручного отзыва)
  createdAt
}
```

### 6 сценариев получения доступа

**1. Покупка отдельного курса**
```
Студент → оплачивает курс → Purchase (type: COURSE, targetId: courseId)
  → Admin подтверждает оплату (MVP) или платёжная система (будущее)
  → Purchase.status = CONFIRMED
  → Создаётся AccessGrant:
      userId, resourceType: COURSE, resourceId: courseId,
      grantedVia: PURCHASE, sourceId: purchaseId,
      expiresAt: null (навсегда)
```

**2. Покупка тарифа**
```
Студент → оплачивает тариф → Purchase (type: TARIFF, targetId: tariffId)
  → Admin подтверждает
  → Purchase.status = CONFIRMED
  → Для каждого курса в TariffCourse создаётся AccessGrant:
      resourceType: COURSE, resourceId: courseId, grantedVia: TARIFF
  → Если тариф включает базу знаний:
      resourceType: KNOWLEDGE_BASE, resourceId: null, grantedVia: TARIFF
  → Если тариф включает AI чат:
      resourceType: AI_CHAT, resourceId: null, grantedVia: TARIFF
  → expiresAt: null (навсегда) или tariff.accessDuration (если ограничен)
```

**3. Ручная выдача доступа админом**
```
Админ → выбирает пользователя → выдаёт доступ к курсу/ресурсу
  → Создаётся AccessGrant:
      grantedVia: ADMIN_GRANT, sourceId: adminUserId
  → AuditLog: action: "ACCESS_GRANTED", actor: adminId, target: userId
```

**4. Бесплатный доступ к демо-уроку**
```
Студент → открывает курс → видит список уроков
  → Урок с lesson.isFree = true → отдаётся без проверки AccessGrant
  → Урок с lesson.isFree = false → проверка AccessGrant на курс
```

**5. Доступ к базе знаний по тарифу**
```
Студент → открывает базу знаний
  → checkResourceAccess(userId, KNOWLEDGE_BASE, null)
  → Ищет AccessGrant с resourceType: KNOWLEDGE_BASE, isActive: true
  → Если найден и не истёк → доступ разрешён
  → Если нет → "Доступно в тарифах: ..."
```

**6. Доступ к AI чату по тарифу**
```
Студент → открывает AI чат
  → checkResourceAccess(userId, AI_CHAT, null)
  → Если AccessGrant найден → проверить AiUsageLimit (дневной/месячный)
  → Лимиты определяются по тарифу, через который выдан AccessGrant
```

### Функция проверки доступа
```
checkAccess(userId, resourceType, resourceId):
  1. Если role === ADMIN → разрешить всегда
  2. Если resourceType === COURSE && lesson.isFree → разрешить
  3. Найти AccessGrant:
       WHERE userId = :userId
       AND resourceType = :resourceType
       AND (resourceId = :resourceId OR resourceId IS NULL)
       AND isActive = true
       AND (expiresAt IS NULL OR expiresAt > NOW())
  4. Если найден → разрешить
  5. Иначе → запретить (вернуть список доступных тарифов)
```

### Матрица доступа

| Ресурс | ADMIN | STUDENT (без доступа) | STUDENT (с доступом) |
|---|---|---|---|
| Управление пользователями | CRUD | — | — |
| Управление курсами | CRUD | — | — |
| Каталог курсов (список) | да | да | да |
| Карточка курса (описание) | да | да | да |
| Содержание урока | да | только isFree | да (по AccessGrant) |
| Задания | CRUD + проверка | — | отправка + просмотр |
| База знаний | CRUD | — | по AccessGrant |
| Вебинары | CRUD + управление | — | по AccessGrant |
| Автовебинары | CRUD | — | по AccessGrant |
| ИИ-чат | да | — | да (с лимитами по тарифу) |
| Партнёрский кабинет | управление | — | если isPartner |
| Свой профиль | да | да | да |
| Покупки (мои) | все покупки | свои | свои |
| Аудит-лог | чтение | — | — |

## 8. AI Module Approach (УСИЛЕНО)

### Архитектура
```
Студент → POST /api/ai/chat
  │
  ├── Auth: requireAuth(request)
  ├── Access: checkResourceAccess(userId, AI_CHAT, null)
  │
  ├── Rate Limiter (daily/monthly limits per user, по тарифу)
  │
  ├── Context Builder
  │     ├── Определить контекст (courseId / knowledgeBase / assignment)
  │     ├── Поиск релевантных фрагментов (RAG)
  │     │     ├── Embed вопрос пользователя
  │     │     ├── pgvector: cosine similarity search (top-5 chunks)
  │     │     ├── Фильтр: только доступные пользователю материалы
  │     │     └── Для каждого chunk: сохранить source reference
  │     │           { sourceType, sourceId, title, chunkIndex }
  │     └── Проверка: если similarity < threshold → пометить "low confidence"
  │
  ├── LLM API Call (Claude API)
  │     ├── System prompt:
  │     │     "Ты — помощник по образовательной платформе ARTWEB.
  │     │      Отвечай ТОЛЬКО на основе предоставленных материалов.
  │     │      Каждый факт сопровождай ссылкой на источник [Источник: название].
  │     │      Если в материалах НЕТ ответа на вопрос, скажи:
  │     │      'В доступных материалах ответ на этот вопрос не найден.'
  │     │      НЕ додумывай, НЕ используй знания за пределами предоставленного контекста."
  │     ├── Context: релевантные фрагменты с metadata
  │     └── User: вопрос студента
  │
  ├── Response Post-Processing
  │     ├── Извлечь упомянутые источники из ответа
  │     ├── Сопоставить с реальными chunk references
  │     └── Сформировать массив sources[] для UI
  │
  ├── Save:
  │     ├── AiChatMessage { role: assistant, content, sources: JSON }
  │     └── sources = [{ sourceType, sourceId, title, relevance }]
  │
  └── Update AiUsageLimit (dailyRequests++)
```

### Source References (НОВОЕ)

Каждый ответ AI содержит:
```json
{
  "content": "Согласно материалам курса, ... [Источник: Урок 3.2]",
  "sources": [
    {
      "sourceType": "LESSON",
      "sourceId": "lesson-uuid",
      "title": "Модуль 3, Урок 2: Договорное право",
      "relevance": 0.87
    },
    {
      "sourceType": "KNOWLEDGE_ITEM",
      "sourceId": "ki-uuid",
      "title": "Шаблон договора подряда",
      "relevance": 0.72
    }
  ],
  "confidence": "high"  // high | medium | low | none
}
```

**Уровни confidence:**
| Уровень | Условие | Поведение |
|---|---|---|
| high | top chunk similarity ≥ 0.8 | Стандартный ответ с источниками |
| medium | similarity 0.6–0.8 | Ответ + предупреждение "информация может быть неполной" |
| low | similarity 0.4–0.6 | "Найдены частично релевантные материалы: ..." |
| none | similarity < 0.4 или нет chunks | "В доступных материалах ответ не найден" |

### Anti-Hallucination Pipeline
1. **System prompt** — жёсткое ограничение: только предоставленный контекст
2. **Low context detection** — если RAG не нашёл релевантных фрагментов, LLM не вызывается; пользователь получает прямой ответ "В материалах не найдено"
3. **Source matching** — после получения ответа LLM, упомянутые источники проверяются на соответствие реальным chunks
4. **Confidence scoring** — каждый ответ получает уровень уверенности на основе similarity scores

### RAG Pipeline (индексация)
```
Админ создаёт/обновляет контент
  │
  ├── Trigger: afterCreate / afterUpdate на Lesson, KnowledgeItem
  │
  ├── Chunker: разбить текст на фрагменты (500-1000 токенов, overlap 100)
  │
  ├── Embedder: embed каждый фрагмент через Embedding API
  │
  └── Store: сохранить в таблицу ai_embeddings
        { content, embedding, sourceType, sourceId, chunkIndex, title }
```

**Индексация выполняется в Worker-процессе (не в web app).**

### Предпроверка заданий
```
Студент отправляет задание
  │
  ├── Assignment.service → AI.service.preReview(assignment, submission)
  │
  ├── Формирование промпта:
  │     ├── Описание задания + критерии оценки
  │     ├── Ответ студента
  │     ├── Макс. балл
  │     └── Инструкция: "Оцени строго по критериям.
  │           Если критерий не выполнен — 0 баллов по нему.
  │           Не додумывай ответ за студента."
  │
  ├── LLM ответ → parse → {aiScore, aiComment, criteriaBreakdown}
  │
  └── Сохранить в AssignmentSubmission (status: AI_REVIEWED)
      Админ видит ИИ-оценку и может подтвердить/скорректировать
```

### Технологический стек AI
| Компонент | Технология | Почему |
|---|---|---|
| LLM | Claude API (Anthropic) | Качество ответов, безопасность, русский язык |
| Embeddings | Voyage AI / OpenAI Embeddings | Для RAG (выбор при реализации) |
| Vector Store | pgvector (расширение PostgreSQL) | Не нужен отдельный сервис, уже есть PostgreSQL |
| Chunking | Собственный (по абзацам + overlap) | Простота, контроль |

### Лимиты AI
| Тариф | Запросов в день | Запросов в месяц |
|---|---|---|
| BASIC | 10 | 100 |
| STANDARD | 30 | 500 |
| PARTNER | 50 | 1000 |
| ADMIN | без лимитов | без лимитов |

## 9. Webinar Module Approach (Живые вебинары)

### MVP-подход: Гибридная архитектура

**Проблема:** полноценный стриминговый сервер (LiveKit, SRS, Janus) требует существенных ресурсов, которых нет на текущем сервере (1 CPU / 2 GB RAM).

**Решение MVP:** платформа управляет метаданными, доступом, чатом и посещаемостью. Видеопоток — через внешний источник.

```
                    Админ (ведущий)
                         │
              ┌──────────┴──────────┐
              │                     │
    OBS/Браузер               Платформа ARTWEB
         │                         │
         │ RTMP                    │ Управление вебинаром
         ▼                         │ (старт, стоп, статус)
    YouTube Live /                 │
    Vimeo / Restream               │
    (unlisted stream)              │
         │                         │
         │ Embed URL               │
         ▼                         ▼
    ┌─────────────────────────────────────┐
    │         Страница вебинара           │
    │  ┌─────────────────┬──────────────┐ │
    │  │  Video Player   │   Чат        │ │
    │  │  (embed iframe) │ (WebSocket)  │ │
    │  │                 │              │ │
    │  │                 │ Сообщения    │ │
    │  │                 │ Участники    │ │
    │  └─────────────────┴──────────────┘ │
    │  Кнопки: материалы, вопрос ведущему │
    └─────────────────────────────────────┘
```

### Сценарий работы
1. Админ создаёт вебинар (дата, время, описание, привязка к тарифу/курсу)
2. Платформа отправляет уведомления (1 день, 1 час, 10 мин до начала)
3. Админ настраивает стрим (YouTube/Vimeo unlisted, получает embed URL)
4. Админ вводит embed URL в админке и нажимает "Начать вебинар"
5. Студенты заходят на страницу → проверка AccessGrant → WebSocket → чат
6. Платформа фиксирует joinedAt / leftAt
7. После завершения: админ вставляет ссылку на запись → сохраняется в recordingUrl

### Риски внешнего video provider (НОВОЕ)

**Embed внешнего сервиса для live-трансляций — допустим в MVP**, так как:
- Live-поток по своей природе эфемерен
- Unlisted-ссылка не индексируется, но может утечь
- Для MVP это приемлемый trade-off при ограниченных ресурсах

**Embed НЕ подходит для защиты платного VOD-контента:**
- Unlisted YouTube/Vimeo ссылки — это security through obscurity
- Ссылку можно скопировать, передать, она будет работать без авторизации
- Записи вебинаров и видеоуроки содержат платный контент

**Рекомендация для платного видеоконтента:**
| Тип контента | MVP-подход | Защита |
|---|---|---|
| Live-стрим | Embed (YouTube/Vimeo unlisted) | Допустимо, эфемерно |
| Запись вебинара | Собственный storage + защищённая выдача | X-Accel-Redirect / secure_link |
| Видеоуроки курсов | Собственный storage + защищённая выдача | X-Accel-Redirect / secure_link |

**Записи и видеоуроки должны храниться на собственном сервере и выдаваться через защищённый механизм (см. раздел 12 Storage).**

### Масштабирование (пост-MVP)
- Этап 2: Установить LiveKit (open source SFU) на отдельный сервер
- Этап 3: RTMP ingest → HLS → CDN для тысяч зрителей

## 10. AutoWebinar Module Approach (ИСПРАВЛЕНО)

### Архитектура
```
Админ загружает видео → Storage (защищённое хранилище)
  │
  ├── Создаёт AutoWebinar (title, video, materials)
  │
  └── Создаёт AutoWebinarSchedule (scheduledAt: 2026-03-25 19:00)

Worker Process — cron (каждые 1 мин):
  │
  ├── Найти AutoWebinarSchedule where scheduledAt <= now AND isActive
  │
  ├── За 1 день / 1 час / 10 мин: отправить напоминания
  │
  └── В момент старта: отправить "Автовебинар начался"

Студент заходит на страницу:
  │
  ├── Проверка AccessGrant
  │
  ├── Если scheduledAt <= now: показать видеоплеер
  │     ├── Видео выдаётся через secure_link (не прямая ссылка)
  │     ├── Воспроизведение привязано к серверному времени старта
  │     ├── UI блокирует перемотку вперёд (имитация live)
  │     └── watchDuration записывается
  │
  ├── Если scheduledAt > now: показать таймер обратного отсчёта
  │
  └── После завершения: показать кнопку "Скачать материалы" (если есть)
```

### Отличие от обычного видео
- Воспроизведение привязано к серверному времени начала
- Все зрители смотрят с одной временной точки
- UI блокирует перемотку вперёд (можно паузу, но при продолжении — текущий live-момент)

### Ограничения запрета перемотки (ИСПРАВЛЕНО)

**Запрет перемотки вперёд — это UI/UX restriction, НЕ security guarantee.**

Ограничения:
- Блокировка реализуется на стороне клиента (JavaScript, кастомный плеер)
- Технически грамотный пользователь может обойти блокировку (DevTools, перехват запросов)
- Видео файл целиком доступен по secure_link на время сессии (byte-range requests для seek)
- Серверная блокировка произвольного seek потребовала бы HLS/DASH с segment-level access control, что выходит за рамки MVP

**Что это даёт в MVP:**
- Для 95%+ пользователей — полноценная имитация live-трансляции
- Ощущение "эфирности" повышает вовлечённость и снижает отток

**Что НЕ даёт:**
- Защиту от скачивания видео
- Гарантированную невозможность перемотки
- DRM-level контроль

**Пост-MVP (если потребуется):** HLS с серверной генерацией playlist на основе текущего серверного времени — каждый сегмент доступен только после его "эфирного" времени.

## 11. Notifications Architecture

### Каналы доставки
```
Событие (триггер)
  │
  ├── NotificationService.send({
  │     userId, type, title, body, metadata,
  │     channels: [IN_APP, EMAIL, TELEGRAM]
  │   })
  │
  ├── IN_APP:
  │     ├── Сохранить в таблицу notifications
  │     └── Push через WebSocket (если клиент online)
  │
  ├── EMAIL:
  │     ├── Рендер HTML-шаблона (React Email или mjml)
  │     ├── Отправить через SMTP (nodemailer)
  │     └── Пометить sentAt
  │
  └── TELEGRAM:
        ├── Найти chatId через TelegramLink
        ├── Отправить через Telegram Bot API
        └── Пометить sentAt
```

### Триггеры уведомлений
| Событие | IN_APP | EMAIL | TELEGRAM |
|---|---|---|---|
| Регистрация | + | + (welcome) | — |
| Подтверждение email | — | + (ссылка) | — |
| Покупка подтверждена | + | + (чек) | + |
| Доступ выдан/забран | + | + | + |
| Вебинар через 1 день | + | + | + |
| Вебинар через 1 час | + | — | + |
| Вебинар через 10 мин | + | — | + |
| Автовебинар начался | + | — | + |
| Задание проверено | + | + | + |
| Новый курс опубликован | + | + | + |
| Восстановление пароля | — | + (ссылка) | — |

## 12. File/Video Storage Strategy (ИСПРАВЛЕНО)

### MVP: Локальное хранилище + nginx

```
/storage/                          # Корневая директория на сервере
├── avatars/                       # Аватары пользователей
│   └── {userId}/avatar.{ext}
├── courses/                       # Материалы курсов
│   └── {courseId}/
│       └── {lessonId}/
│           ├── video.mp4          # Видео урока
│           └── files/             # Прикреплённые файлы
│               └── {fileId}.{ext}
├── assignments/                   # Загрузки студентов
│   └── {submissionId}/
│       └── {filename}
├── knowledge-base/                # Документы базы знаний
│   └── {itemId}/
│       └── {filename}
├── webinars/                      # Записи вебинаров
│   └── {webinarId}/
│       └── recording.mp4
└── auto-webinars/                 # Видео автовебинаров
    └── {autoWebinarId}/
        └── video.mp4
```

### Два механизма защищённой выдачи файлов

**Механизм 1: X-Accel-Redirect (для скачивания файлов)**

Используется для: документов, файлов заданий, аватаров — всего, что скачивается целиком.

```
Клиент                      nginx                     Next.js API
  │                           │                           │
  │── GET /api/files/:id/download ──────────────────────→│
  │                           │                           │── requireAuth()
  │                           │                           │── checkAccess()
  │                           │                           │── если доступ есть:
  │                           │←── Response ──────────────│
  │                           │    X-Accel-Redirect:      │
  │                           │    /internal-storage/path │
  │                           │    Content-Disposition:   │
  │                           │    attachment; filename=  │
  │                           │                           │
  │                           │── читает файл из ФС      │
  │←── file content ─────────│                           │
```

**Ключевой момент:** клиент обращается ТОЛЬКО к `/api/files/:id/download`. Клиент никогда не знает реальный путь к файлу. nginx видит заголовок `X-Accel-Redirect` и подставляет файл из internal location.

```nginx
# nginx config
location /internal-storage/ {
    internal;                          # ТОЛЬКО через X-Accel-Redirect
    alias /storage/;
    add_header Cache-Control "private, no-cache";
    add_header X-Content-Type-Options nosniff;
}
```

**Механизм 2: Signed URL + nginx secure_link (для потокового видео)**

Используется для: видеоуроков, записей вебинаров, автовебинаров — всего, что воспроизводится в `<video>` теге и требует byte-range requests (seek).

```
Шаг 1: Получение signed URL
Клиент                      Next.js API
  │                           │
  │── GET /api/files/:id/url ──→│
  │                           │── requireAuth()
  │                           │── checkAccess()
  │                           │── generate signed URL:
  │                           │   /media/{md5_hash}/?expires=TIMESTAMP
  │                           │   md5 = MD5(expires + path + secret)
  │←── { url, expiresAt } ───│

Шаг 2: Воспроизведение видео
Клиент (video player)       nginx
  │                           │
  │── GET /media/{hash}/?expires=T ──→│
  │   (src в <video> теге)   │── secure_link module:
  │                           │   проверяет md5 + expires
  │                           │   если валидно → отдаёт файл
  │                           │   если невалидно → 403
  │                           │   если истекло → 410
  │←── video stream (byte-range) ─│
```

```nginx
# nginx config для видео
location /media/ {
    secure_link $arg_hash,$arg_expires;
    secure_link_md5 "$secure_link_expires$uri MEDIA_SECRET";

    if ($secure_link = "") { return 403; }
    if ($secure_link = "0") { return 410; }  # expired

    alias /storage/;
    add_header Cache-Control "private, no-cache";
    add_header Accept-Ranges bytes;
}
```

**Параметры signed URL:**
- Время жизни: 2 часа (для видеоурока), 4 часа (для автовебинара)
- Привязан к пути файла + timestamp
- НЕ привязан к IP (чтобы работал при смене сети)
- Secret хранится в .env, совпадает в nginx config и Next.js

### Что НЕ делает Storage в MVP
- Не привязывает URL к IP (ненадёжно при мобильных сетях)
- Не использует DRM (сложность не оправдана для MVP)
- Не режет видео на HLS-сегменты (нет необходимости при текущей аудитории)

### Масштабирование (пост-MVP)
| Этап | Стратегия |
|---|---|
| MVP | Локальная ФС + nginx (X-Accel-Redirect + secure_link) |
| Этап 2 | MinIO (S3-compatible) на том же сервере + presigned URLs |
| Этап 3 | Внешний S3 (Selectel / Yandex Cloud) + CDN + HLS |

### Ограничения MVP
- Макс. размер файла: 500 MB (видео), 50 MB (документы), 5 MB (аватар)
- Форматы видео: MP4 (H.264)
- Форматы документов: PDF, DOCX, XLSX, PPTX, TXT
- Общий объём: ограничен диском сервера (21 GB свободно)

## 13. Process Topology (ПЕРЕРАБОТАНО)

### Три раздельных процесса

```
PM2
├── artweb          (Next.js, port 3003)  — Web App
│     ├── SSR pages
│     ├── API Routes (все HTTP endpoints)
│     ├── Auth (middleware + lib/auth.ts)
│     └── Static assets
│
├── artweb-ws       (ws, port 3004)       — WebSocket Server
│     ├── Webinar chat (per-room)
│     ├── In-app notification push
│     ├── Online presence (who's watching)
│     └── Auth: JWT validation при подключении
│
└── artweb-worker   (node, no port)       — Worker / Cron
      ├── Cron: напоминания о вебинарах (1 день / 1 час / 10 мин)
      ├── Cron: напоминания об автовебинарах
      ├── Cron: сброс AI daily/monthly limits
      ├── Cron: деактивация истёкших AccessGrant (expiresAt)
      ├── Queue: AI RAG индексация (embed + store chunks)
      ├── Queue: email отправка (batch)
      └── Cleanup: удаление истёкших EmailToken, старых SecurityLog
```

### Почему раздельно

| Проблема | Решение |
|---|---|
| Cron в WS-сервере → при рестарте WS теряются cron-задачи | Worker — независимый процесс |
| Cron в web app → при нескольких инстансах дублируются задачи | Worker всегда один экземпляр |
| AI индексация блокирует event loop | Worker выполняет тяжёлые операции отдельно |
| WS рестарт → cron сброс | Каждый процесс перезапускается независимо |

### Взаимодействие между процессами

```
Web App ──→ PostgreSQL ←── Worker
    │                        ↑
    │                        │ (shared DB)
    └──→ WS Server ──────────┘
          ↑
          │ (JWT при подключении)
```

Процессы общаются через БД (не через IPC):
- Web App создаёт запись в `notifications` → Worker (или WS) считывает и доставляет
- Worker обновляет `AccessGrant.isActive = false` → Web App видит при следующем запросе
- WS Server читает авторизацию из JWT, не ходит в Web App

### MVP: допустимые упрощения
- Worker может быть простым node-скриптом с `node-cron`
- Очередь задач — через таблицу в БД (poll), без Redis/Bull
- При одном сервере и одном инстансе это достаточно надёжно

## 14. Deployment Baseline

### Текущая инфраструктура
```
Сервер: 5.42.110.182
├── OS: Ubuntu 24.04 LTS
├── CPU: 1 core
├── RAM: 2 GB
├── Disk: 29 GB (21 GB free)
├── nginx: reverse proxy + SSL + static + secure_link
├── PostgreSQL 16: база данных
├── Node.js 20: runtime
├── PM2: process manager
└── UFW: firewall
```

### Деплой-процесс (MVP)
```
1. Разработка локально (Windows)
2. git push origin main
3. SSH на сервер:
   cd /var/www/artweb
   git pull
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   pm2 restart artweb artweb-ws artweb-worker
```

### Пост-MVP: CI/CD
```
GitHub Actions:
  push to main → build → test → SSH deploy → PM2 restart
```

## 15. Scaling Considerations

### Вертикальное масштабирование (первый шаг)
| Текущее | Рекомендация | Когда |
|---|---|---|
| 1 CPU | 2-4 CPU | >100 одновременных пользователей |
| 2 GB RAM | 4-8 GB | >50 одновременных запросов к ИИ |
| 29 GB SSD | 100+ GB | >50 видеоуроков |

### Горизонтальное масштабирование (когда вертикальное исчерпано)
```
Этап 1 (текущий):     [1 сервер — всё]
Этап 2 (рост):        [App server] ←→ [DB server]
Этап 3 (масштаб):     [App 1] [App 2] ←→ [Load Balancer] ←→ [DB primary + replica]
                                                              [Redis (sessions, cache)]
                                                              [S3 (файлы)]
                                                              [Media Server (стриминг)]
```

### Что нужно учесть уже в MVP для будущего масштабирования
| Решение | Зачем |
|---|---|
| Stateless JWT (без server-side session state в памяти) | Несколько инстансов приложения |
| Refresh tokens в БД (не в памяти) | Переносимость между серверами |
| Файлы через абстракцию Storage | Замена FS → S3 без переписывания |
| Signed URLs / secure_link для видео | CDN-ready |
| WebSocket на отдельном порте | Вынос в отдельный сервис |
| Worker как отдельный процесс | Не дублируется при нескольких инстансах |
| pgvector в PostgreSQL | Вынос в отдельный vector DB при необходимости |
| AccessGrant как отдельная сущность | Замена логики доступа без переделки бизнес-модулей |

## 16. Сущности верхнего уровня (ОБНОВЛЕНО)

```
User ──────── Session
  │           EmailToken
  │           TelegramLink
  │           PartnerProfile ──── PartnerReferral
  │
  ├── Purchase ──→ AccessGrant ──→ (Course, KnowledgeBase, AiChat, Webinar, AutoWebinar)
  │   (покупка)    (право доступа)
  │
  ├── AccessGrant ←── Tariff ──── TariffCourse ──── Course
  │   (тариф даёт множество грантов)                  │
  │                                       Module ──── Lesson
  │                                                     │
  │                                           ┌─────────┼──────────┐
  │                                      LessonFile  Assignment  Checklist
  │                                                     │           │
  │                                                TestOption  ChecklistItem
  │
  ├── CourseProgress
  ├── LessonProgress
  ├── AssignmentSubmission
  │
  ├── AiChatSession ──── AiChatMessage (+ sources JSON)
  ├── AiUsageLimit
  │
  ├── WebinarAttendance ──── Webinar
  ├── WebinarChatMessage
  │
  ├── AutoWebinarView ──── AutoWebinar ──── AutoWebinarSchedule
  │                                    ──── AutoWebinarMaterial
  │
  ├── Notification
  ├── PromoCodeUsage ──── PromoCode
  └── SecurityLog

BillingRecord ──── Purchase (финансовая запись)
AuditLog (cross-cutting, all admin actions)
KnowledgeItem (standalone, access by AccessGrant)
```

## 17. API Domains (высокий уровень)

### Auth Domain
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/verify-email
```

### User Domain
```
GET    /api/users/me
PATCH  /api/users/me
POST   /api/users/me/avatar
DELETE /api/users/me/avatar
GET    /api/users/me/sessions
DELETE /api/users/me/sessions/:id
```

### Course Domain
```
GET    /api/courses                    # каталог (публичный)
GET    /api/courses/:slug              # карточка курса
GET    /api/courses/:slug/lessons/:lessonSlug  # урок (проверка AccessGrant)
POST   /api/courses/:slug/lessons/:lessonSlug/complete
GET    /api/courses/:slug/progress
```

### Assignment Domain
```
GET    /api/assignments/:id
POST   /api/assignments/:id/submit
GET    /api/assignments/my             # мои задания
```

### Knowledge Base Domain
```
GET    /api/knowledge-base             # список (с поиском)
GET    /api/knowledge-base/:slug       # документ
GET    /api/knowledge-base/search?q=   # полнотекстовый поиск
```

### Webinar Domain
```
GET    /api/webinars                    # список
GET    /api/webinars/:slug             # страница вебинара
POST   /api/webinars/:slug/join        # зафиксировать вход
POST   /api/webinars/:slug/leave       # зафиксировать выход
```

### AutoWebinar Domain
```
GET    /api/auto-webinars              # список
GET    /api/auto-webinars/:slug        # страница
POST   /api/auto-webinars/:slug/watch  # зафиксировать просмотр
```

### AI Domain
```
POST   /api/ai/chat                    # сообщение в чат
GET    /api/ai/sessions                # мои сессии
GET    /api/ai/sessions/:id            # история сессии (+ sources)
GET    /api/ai/limits                  # мои лимиты
```

### Notification Domain
```
GET    /api/notifications              # мои уведомления
PATCH  /api/notifications/:id/read     # пометить прочитанным
POST   /api/notifications/read-all     # прочитать все
GET    /api/notifications/unread-count # счётчик
```

### Partner Domain
```
GET    /api/partner/profile            # мой партнёрский профиль
GET    /api/partner/referrals          # мои рефералы
GET    /api/partner/stats              # статистика
```

### Tariff Domain
```
GET    /api/tariffs                    # доступные тарифы
POST   /api/tariffs/apply-promo       # применить промокод
```

### Payment Domain (НОВЫЙ)
```
POST   /api/payments/purchase          # создать покупку (курс или тариф)
GET    /api/payments/my                # мои покупки
GET    /api/payments/:id               # детали покупки
```

### File Domain
```
GET    /api/files/:id/download         # скачать файл (X-Accel-Redirect)
GET    /api/files/:id/url              # получить signed URL (для видео)
POST   /api/files/upload               # загрузка файла (admin)
```

### Admin Domain
```
GET/POST/PATCH/DELETE /api/admin/users
GET/POST/PATCH/DELETE /api/admin/courses
GET/POST/PATCH/DELETE /api/admin/modules
GET/POST/PATCH/DELETE /api/admin/lessons
GET/POST/PATCH/DELETE /api/admin/assignments
GET/POST/PATCH/DELETE /api/admin/tariffs
GET/POST/PATCH/DELETE /api/admin/promo-codes
GET/POST/PATCH/DELETE /api/admin/webinars
GET/POST/PATCH/DELETE /api/admin/auto-webinars
GET/POST/PATCH/DELETE /api/admin/knowledge-base
GET/PATCH             /api/admin/submissions      # проверка заданий
GET/PATCH             /api/admin/partners

# Payment management
GET                   /api/admin/purchases         # все покупки
PATCH                 /api/admin/purchases/:id      # подтвердить/отменить

# Access management
POST                  /api/admin/access/grant       # ручная выдача доступа
DELETE                /api/admin/access/:id          # отзыв доступа
GET                   /api/admin/access/user/:userId # доступы пользователя

# Audit
GET                   /api/admin/audit-log          # аудит-лог
GET                   /api/admin/security-logs      # логи безопасности

GET                   /api/admin/dashboard          # метрики
```

### Health
```
GET    /api/health
```
