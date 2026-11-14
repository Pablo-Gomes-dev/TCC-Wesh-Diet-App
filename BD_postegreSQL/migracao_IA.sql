--==============================================================================
-- MIGRAÇÃO ADITIVA - FASE 0: INFRAESTRUTURA DE IA, REVISÃO PROFISSIONAL E LGPD
-- ==============================================================================
-- Não remove nem altera dados existentes. Pode ser executada mais de uma vez.
-- Cria: planos_alimentares, checkins, analises_checkins, ia_uso_log,
--       consentimentos, log_auditoria e amplia relatorios_exames.
-- ==============================================================================
 
BEGIN;
 
-- 1. RELATÓRIOS DE EXAMES: METADADOS DA IA E REVISÃO PROFISSIONAL
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS modelo VARCHAR(60);
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS versao_prompt VARCHAR(30);
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS conteudo_json JSONB;
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS status_revisao VARCHAR(20) NOT NULL DEFAULT 'pendente';
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS revisado_por BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE relatorios_exames ADD COLUMN IF NOT EXISTS revisado_em TIMESTAMPTZ;
 
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_relatorio_status_revisao') THEN
        ALTER TABLE relatorios_exames ADD CONSTRAINT chk_relatorio_status_revisao
            CHECK (status_revisao IN ('pendente', 'aprovado', 'rejeitado'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_relatorio_revisao_identificada') THEN
        ALTER TABLE relatorios_exames ADD CONSTRAINT chk_relatorio_revisao_identificada
            CHECK (status_revisao = 'pendente' OR (revisado_por IS NOT NULL AND revisado_em IS NOT NULL));
    END IF;
END $$;
 
-- 2. PLANOS ALIMENTARES (NASCEM COMO RASCUNHO; SÓ 'aprovado' É VISÍVEL AO PACIENTE)
CREATE TABLE IF NOT EXISTS planos_alimentares (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    nutricionista_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    conteudo_json JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    gerado_por_ia BOOLEAN NOT NULL DEFAULT TRUE,
    modelo VARCHAR(60),
    versao_prompt VARCHAR(30),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprovado_por BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    aprovado_em TIMESTAMPTZ,
    CONSTRAINT chk_plano_status CHECK (status IN ('rascunho', 'aprovado', 'arquivado')),
    CONSTRAINT chk_plano_aprovacao_identificada
        CHECK (status <> 'aprovado' OR (aprovado_por IS NOT NULL AND aprovado_em IS NOT NULL))
);
 
-- NO MÁXIMO UM PLANO APROVADO (VIGENTE) POR PACIENTE
CREATE UNIQUE INDEX IF NOT EXISTS uq_plano_aprovado_por_paciente
    ON planos_alimentares (paciente_id) WHERE status = 'aprovado';
CREATE INDEX IF NOT EXISTS idx_planos_paciente_data
    ON planos_alimentares (paciente_id, criado_em DESC);
 
-- 3. CHECK-INS DO PACIENTE
CREATE TABLE IF NOT EXISTS checkins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    data_checkin DATE NOT NULL DEFAULT CURRENT_DATE,
    peso_kg NUMERIC(5,2) NOT NULL,
    medidas JSONB NOT NULL DEFAULT '{}'::jsonb,   -- ex.: {"cintura_cm": 82.5, "quadril_cm": 98}
    adesao_percentual SMALLINT,
    dificuldades TEXT,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_checkin_peso CHECK (peso_kg > 0),
    CONSTRAINT chk_checkin_adesao CHECK (adesao_percentual IS NULL OR adesao_percentual BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_checkins_paciente_data
    ON checkins (paciente_id, data_checkin DESC, id DESC);
 
-- 4. ANÁLISES DE CHECK-IN (DIFERENÇAS CALCULADAS PELO PYTHON + TEXTO DA IA)
CREATE TABLE IF NOT EXISTS analises_checkins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checkin_id BIGINT NOT NULL UNIQUE REFERENCES checkins(id) ON DELETE RESTRICT,
    checkin_anterior_id BIGINT REFERENCES checkins(id) ON DELETE RESTRICT,
    paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    classificacao VARCHAR(20),
    diferencas JSONB NOT NULL DEFAULT '{}'::jsonb,
    conteudo_json JSONB,
    modelo VARCHAR(60),
    versao_prompt VARCHAR(30),
    status VARCHAR(20) NOT NULL DEFAULT 'gerando',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_analise_classificacao
        CHECK (classificacao IS NULL OR classificacao IN ('evolucao', 'estabilidade', 'involucao')),
    CONSTRAINT chk_analise_status CHECK (status IN ('gerando', 'finalizado', 'erro'))
);
CREATE INDEX IF NOT EXISTS idx_analises_checkins_paciente
    ON analises_checkins (paciente_id, criado_em DESC);
 
-- 5. CONSUMO DE IA (NÃO ARMAZENA CONTEÚDO CLÍNICO)
CREATE TABLE IF NOT EXISTS ia_uso_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    paciente_id BIGINT REFERENCES pacientes(id) ON DELETE SET NULL,
    funcionalidade VARCHAR(20) NOT NULL,
    modelo VARCHAR(60) NOT NULL,
    tokens_entrada INTEGER,
    tokens_saida INTEGER,
    custo_estimado_usd NUMERIC(10,6),
    duracao_ms INTEGER,
    resultado VARCHAR(10) NOT NULL,
    tipo_erro VARCHAR(40),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ia_uso_funcionalidade CHECK (funcionalidade IN ('plano', 'exame', 'checkin')),
    CONSTRAINT chk_ia_uso_resultado CHECK (resultado IN ('sucesso', 'erro'))
);
CREATE INDEX IF NOT EXISTS idx_ia_uso_data ON ia_uso_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ia_uso_funcionalidade ON ia_uso_log (funcionalidade, criado_em DESC);
 
-- 6. CONSENTIMENTOS (HISTÓRICO APPEND-ONLY; VIGENTE = REGISTRO MAIS RECENTE)
CREATE TABLE IF NOT EXISTS consentimentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    finalidade VARCHAR(50) NOT NULL,
    versao_texto VARCHAR(20) NOT NULL,
    concedido BOOLEAN NOT NULL,
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consentimentos_usuario
    ON consentimentos (usuario_id, finalidade, registrado_em DESC);
 
-- 7. AUDITORIA (SEM SENHAS, TOKENS OU CONTEÚDO CLÍNICO)
CREATE TABLE IF NOT EXISTS log_auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(60) NOT NULL,
    recurso VARCHAR(60) NOT NULL,
    recurso_id BIGINT,
    resultado VARCHAR(20) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON log_auditoria (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_recurso ON log_auditoria (recurso, recurso_id);
 
COMMIT;