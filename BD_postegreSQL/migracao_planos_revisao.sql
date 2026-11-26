BEGIN;
ALTER TABLE planos_alimentares DROP CONSTRAINT IF EXISTS chk_plano_status;
ALTER TABLE planos_alimentares ADD CONSTRAINT chk_plano_status CHECK (status IN ('rascunho', 'revisao_solicitada', 'aprovado', 'arquivado'));
ALTER TABLE planos_alimentares ADD COLUMN IF NOT EXISTS contexto_geracao JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE planos_alimentares ADD COLUMN IF NOT EXISTS observacao_revisao TEXT;
ALTER TABLE planos_alimentares ADD COLUMN IF NOT EXISTS revisao_solicitada_por BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE planos_alimentares ADD COLUMN IF NOT EXISTS revisao_solicitada_em TIMESTAMPTZ;
COMMIT;
