-- Flag administrativa para a tela de aprovação de nutricionistas.
BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
COMMIT;

-- Após aplicar: UPDATE usuarios SET is_admin = TRUE WHERE email = 'admin@exemplo.com';
