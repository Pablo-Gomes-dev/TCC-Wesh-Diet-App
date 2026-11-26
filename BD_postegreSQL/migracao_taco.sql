BEGIN;

CREATE TABLE IF NOT EXISTS taco_importacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fonte VARCHAR(80) NOT NULL DEFAULT 'TACO',
    instituicao VARCHAR(160) NOT NULL DEFAULT 'NEPA/UNICAMP',
    edicao VARCHAR(80) NOT NULL,
    ano INTEGER NOT NULL,
    arquivo_pdf VARCHAR(255) NOT NULL,
    arquivo_csv VARCHAR(255) NOT NULL,
    hash_pdf CHAR(64) NOT NULL,
    hash_csv CHAR(64) NOT NULL,
    total_registros INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    importado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprovado_em TIMESTAMPTZ,
    aprovado_por BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_taco_importacao_status CHECK (status IN ('pendente','aprovada','inativa','rejeitada'))
);

CREATE TABLE IF NOT EXISTS taco_alimentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    importacao_id BIGINT NOT NULL REFERENCES taco_importacoes(id) ON DELETE RESTRICT,
    codigo_taco INTEGER NOT NULL,
    nome TEXT NOT NULL,
    categoria TEXT,
    unidade_referencia VARCHAR(30) NOT NULL DEFAULT '100 g',
    valores_originais JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (importacao_id, codigo_taco)
);

CREATE TABLE IF NOT EXISTS taco_composicao (
    alimento_id BIGINT PRIMARY KEY REFERENCES taco_alimentos(id) ON DELETE CASCADE,
    umidade_g NUMERIC, energia_kcal NUMERIC, energia_kj NUMERIC,
    proteina_g NUMERIC, lipidios_g NUMERIC, colesterol_mg NUMERIC,
    carboidratos_g NUMERIC, fibra_g NUMERIC, cinzas_g NUMERIC,
    calcio_mg NUMERIC, magnesio_mg NUMERIC, manganes_mg NUMERIC,
    fosforo_mg NUMERIC, ferro_mg NUMERIC, sodio_mg NUMERIC,
    potassio_mg NUMERIC, cobre_mg NUMERIC, zinco_mg NUMERIC,
    retinol_mcg NUMERIC, vitamina_a_re_mcg NUMERIC, vitamina_a_rae_mcg NUMERIC,
    tiamina_mg NUMERIC, riboflavina_mg NUMERIC, piridoxina_mg NUMERIC,
    niacina_mg NUMERIC, vitamina_c_mg NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_taco_alimentos_nome ON taco_alimentos USING gin (to_tsvector('simple', nome));
CREATE INDEX IF NOT EXISTS idx_taco_alimentos_categoria ON taco_alimentos (categoria);
CREATE UNIQUE INDEX IF NOT EXISTS uq_taco_importacao_aprovada
    ON taco_importacoes (fonte, edicao, ano) WHERE status = 'aprovada';

COMMIT;
