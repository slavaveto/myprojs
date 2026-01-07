-- Делаем так, чтобы ID генерировался автоматически при вставке новых записей

ALTER TABLE "_users" ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "_ui_folders" ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "_ui_items" ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "_logs" ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- На всякий случай для _docs, если будет использоваться
-- ALTER TABLE "_docs" ALTER COLUMN id SET DEFAULT gen_random_uuid();

