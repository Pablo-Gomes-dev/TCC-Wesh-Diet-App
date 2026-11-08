-- ==============================================================================
-- MIGRAÇÃO ADITIVA: SUPORTE A CÓDIGO DE VÍNCULO DO NUTRICIONISTA
-- ==============================================================================
-- Adiciona a coluna codigo_vinculo na tabela usuarios para contas de nutricionistas.
-- O código é único e permite que os pacientes vinculem-se digitando esse código.
-- ==============================================================================

BEGIN;

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS codigo_vinculo VARCHAR(20) UNIQUE;

-- Cria índice para buscas rápidas pelo código de vínculo
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo_vinculo 
ON usuarios (codigo_vinculo) 
WHERE codigo_vinculo IS NOT NULL;

COMMIT;
