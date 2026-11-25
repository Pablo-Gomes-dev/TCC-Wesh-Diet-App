-- Migração aditiva: referência do perfil inicial para evolução.
-- Não remove, recria ou sobrescreve tabelas existentes.
BEGIN;

ALTER TABLE pacientes
ADD COLUMN IF NOT EXISTS dados_iniciais JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
