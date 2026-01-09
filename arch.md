Архитектура проекта и Терминология (Контекст)
Стек: Next.js, PowerSync (SQLite WASM), Supabase, Clerk.
Тип: Local-First с поддержкой множественных изолированных баз данных.

Терминология Баз Данных:
SQLite DBs (Локальные в браузере):
Main SQLite (daysync_db.sqlite) — хранилище для DaySync.
Remote SQLite (remote_{id}.sqlite) — изолированное хранилище для конкретного Remote проекта.
Cloud DBs (Supabase в облаке):
Main Cloud (Supabase "DaySync") — главная база. Синхронизируется с Main SQLite.
Remote Cloud (Supabase "VideoRoom" и др.) — выделенная база. 

Синхронизируется с Remote SQLite.
1. DaySync (Главный локальный проект):
База: Работает на Main SQLite.
Бэкенд: Синхронизируется с Main Cloud.
Данные: Хранит ВСЕ свои данные (задачи, папки, логи, а также таблицы _ui_folders и _ui_items) в Main SQLite.
Схема: AppSchema.ts.
Провайдер: Глобальный SyncProvider.
2. Remote Проекты (VideoRoom, PsyHelp и др.):
Определение: Проекты с флагом has_remote = true (конфиг в remoteConfig.ts).
Изоляция: Каждый проект имеет свой собственный Remote SQLite.
Бэкенд: Подключается к своему выделенному Remote Cloud (URL/Keys жестко заданы в remoteConfig.ts).
Данные: Хранят свои _ui_folders и _ui_items только в своем Remote SQLite.
Схема: RemoteAppSchema.ts.
Провайдер: RemoteSyncProvider (рендерится внутри ProjectView).
Upload: Реализован через кастомный StaticRemoteConnector.
Ключи: Использует supabaseUrl и serviceKey (Service Role Key из .env NEXT_PUBLIC_..._SERVICE_KEY), которые берутся из utils/remoteConfig.ts.
Логика: Создает отдельный Supabase Client с этими ключами для записи данных (upsert/delete) именно в Remote Cloud, минуя ограничения главного клиента.
Безопасность: Service Key используется локально на клиенте (разрешено в рамках этого проекта), так как это админский интерфейс владельца.

3. Технические детали:
Синглтон: Глобальный dbCache предотвращает дублирование подключений к файлам Remote SQLite.
Рендер: Все проекты рендерятся в DOM (page.tsx), но неактивные скрыты (display: none), чтобы сохранять стейт. Активные Remote проекты держат соединение.
Проверка: useSyncCheck проверяет целостность пар (SQLite vs Cloud) для всех активных баз (как Main, так и Remote), используя соответствующие ключи доступа.