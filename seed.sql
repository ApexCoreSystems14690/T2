-- Seed: Corporações Santa Fé
-- Gerado automaticamente a partir dos dados do jogo
-- Rodar com: psql $DATABASE_URL -f seed.sql

BEGIN;

-- Pega o owner_id (primeiro admin ou primeiro user)
DO $$
DECLARE
  v_owner_id INTEGER;
  v_corp_id INTEGER;
BEGIN
  SELECT id INTO v_owner_id FROM users WHERE is_admin = true LIMIT 1;
  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM users ORDER BY id LIMIT 1;
  END IF;

  -- Polícia Militar
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Polícia Militar', 'policia-militar', 'Corporação da Polícia Militar do Estado. Responsável pelo policiamento ostensivo e manutenção da ordem pública.', v_owner_id, '#1E40AF', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Polícia Militar
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Comandante', 16, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Comandante', 15, 18000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Tenente-Coronel', 14, 13000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Major', 13, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Capitão', 12, 8500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Primeiro-Tenente', 11, 6000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Segundo-Tenente', 10, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aspirante-A-Oficial', 9, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Tenente', 8, 4000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '1º Sargento', 7, 3500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '2º Sargento', 6, 3000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '3º Sargento', 5, 2500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Cabo', 4, 2000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Soldado', 3, 1200);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Recruta', 2, 1200);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Holder', 1, 2125);

  -- CHOQUE
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('CHOQUE', 'choque', 'Batalhão de Choque. Unidade especializada em operações de controle de distúrbios e ações táticas.', v_owner_id, '#1F2937', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de CHOQUE
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Comandante', 16, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Comandante', 15, 18000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Tenente-Coronel', 14, 13000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Major', 13, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Capitão', 12, 8500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Primeiro-Tenente', 11, 6000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Segundo-Tenente', 10, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aspirante-A-Oficial', 9, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Tenente', 8, 4000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '1º Sargento', 7, 3500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '2º Sargento', 6, 3000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '3º Sargento', 5, 2500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Cabo', 4, 2000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Soldado', 3, 1200);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Recruta', 2, 1200);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Holder', 1, 2125);

  -- BOPE
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('BOPE', 'bope', 'Batalhão de Operações Policiais Especiais. Unidade de elite para operações de alto risco.', v_owner_id, '#DC2626', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de BOPE
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Comandante', 14, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Comandante', 13, 18000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Tenente-Coronel', 12, 13000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Major', 11, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Capitão', 10, 8500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Primeiro-Tenente', 9, 6000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Segundo-Tenente', 8, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aspirante-A-Oficial', 7, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Tenente', 6, 4000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '1º Sargento', 5, 3500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '2º Sargento', 4, 3000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '3º Sargento', 3, 2500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Cabo', 2, 2000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Soldado', 1, 1200);

  -- Polícia Civil
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Polícia Civil', 'policia-civil', 'Polícia Civil do Estado. Responsável pela investigação criminal e polícia judiciária.', v_owner_id, '#7C3AED', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Polícia Civil
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[DLG-G] Delegado Geral', 18, 19000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[DLG-ADJ] Delegado Adjunto', 17, 17000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[DLG-1º] Delegado de Primeira Classe', 16, 15000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[DLG-2º] Delegado de Segunda Classe', 15, 14500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[DLG-3º] Delegado de Terceira Classe', 14, 13500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[ESC] Escrivão', 13, 11500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[PRT-C] Perito Criminal', 12, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[LEG] Legista', 11, 10500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[INV-1º] Investigador de Primeira Classe', 10, 10000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[INV-2º] Investigador de Segunda Classe', 9, 9500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[INV-3º] Investigador de Terceira Classe', 8, 9000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[INV] Investigador', 7, 8650);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[AGT-1º] Agente de Primeira Classe', 6, 7650);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[AGT-2º] Agente de Segunda Classe', 5, 5950);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[AGT-3º] Agente de Terceira Classe', 4, 4250);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '[AGT-P] Agente de Polícia', 3, 2550);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aluno', 2, 2210);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Holder', 1, 2125);

  -- SAMU
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('SAMU', 'samu', 'Serviço de Atendimento Móvel de Urgência. Responsável pelo atendimento médico de emergência.', v_owner_id, '#EF4444', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de SAMU
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretor Externo', 11, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretor Externo Interino', 10, 18000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Vice-Diretor', 9, 15000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Chefe de Medicina', 8, 12500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Supervisor Geral', 7, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Supervisor em Estágio', 6, 9600);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Condutor Socorrista', 5, 8000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Médico Hospitalar', 4, 6500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Médico Socorrista', 3, 5500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Enfermeiro', 2, 4500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Estagiário de Medicina', 1, 3000);

  -- ROTAM
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('ROTAM', 'rotam', 'Rondas Ostensivas Táticas Metropolitanas. Unidade de patrulhamento tático.', v_owner_id, '#059669', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de ROTAM
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Comandante', 15, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Comandante', 14, 18000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Coronel', 13, 16000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Tenente-Coronel', 12, 13000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Major', 11, 11000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Capitão', 10, 8500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Primeiro-Tenente', 9, 6000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Segundo-Tenente', 8, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aspirante-A-Oficial', 7, 5000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Tenente', 6, 4000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '1º Sargento', 5, 3500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '2º Sargento', 4, 3000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, '3º Sargento', 3, 2500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Cabo', 2, 2000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Soldado', 1, 1200);

  -- Governo
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Governo', 'governo', 'Governo do Estado. Administração pública e gestão governamental.', v_owner_id, '#D97706', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Governo
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Governador', 3, 32000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Prefeito', 2, 26000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Deputado', 1, 18000);

  -- Polícia Federal
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Polícia Federal', 'policia-federal', 'Polícia Federal. Responsável por crimes federais, tráfico internacional e segurança de fronteiras.', v_owner_id, '#1D4ED8', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Polícia Federal
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretor Geral', 13, 26000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretor', 12, 23500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretor Adjunto', 11, 20000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Perito Criminal', 10, 17000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Investigador', 9, 14000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Sub-Investigador', 8, 13000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Escrivão', 7, 12000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Agente Especial', 6, 10000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Agente Operacional', 5, 8000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Agente 1º Classe', 4, 7500);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Agente 2º Classe', 3, 7000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Agente 3º Classe', 2, 4250);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Aluno', 1, 2125);

  -- Jornal Nacional
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Jornal Nacional', 'jornal', 'Jornal Nacional. Cobertura jornalística e reportagens da cidade.', v_owner_id, '#F59E0B', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Jornal Nacional
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Diretores', 3, 9350);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Jornalista', 2, 1700);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Holder', 1, 2125);

  -- Pavuna
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Pavuna', 'pavuna', 'Facção Pavuna. Organização do submundo da cidade.', v_owner_id, '#991B1B', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;
  -- Cargos de Pavuna
  DELETE FROM ranks WHERE corporation_id = v_corp_id;
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Proprietário', 3, 21000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Administrador', 2, 15000);
  INSERT INTO ranks (corporation_id, name, level, salary) VALUES (v_corp_id, 'Membro', 1, 10000);

  -- Franca
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Franca', 'franca', 'Facção Franca. Organização rival no submundo.', v_owner_id, '#78350F', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Bombeiro Militar
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Bombeiro Militar', 'bombeiro-militar', 'Corpo de Bombeiros Militar. Combate a incêndios, resgates e atendimento de emergência.', v_owner_id, '#F97316', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 1
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 1', 'extra-1', 'Corporação reserva 1.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 2
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 2', 'extra-2', 'Corporação reserva 2.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 3
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 3', 'extra-3', 'Corporação reserva 3.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 4
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 4', 'extra-4', 'Corporação reserva 4.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 5
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 5', 'extra-5', 'Corporação reserva 5.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 6
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 6', 'extra-6', 'Corporação reserva 6.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 7
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 7', 'extra-7', 'Corporação reserva 7.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 8
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 8', 'extra-8', 'Corporação reserva 8.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 9
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 9', 'extra-9', 'Corporação reserva 9.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 10
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 10', 'extra-10', 'Corporação reserva 10.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 11
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 11', 'extra-11', 'Corporação reserva 11.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

  -- Extra 12
  INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
    VALUES ('Extra 12', 'extra-12', 'Corporação reserva 12.', v_owner_id, '#6B7280', 100)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO v_corp_id;

END $$;

COMMIT;

SELECT c.name, c.slug, c.color, (SELECT COUNT(*) FROM ranks WHERE corporation_id = c.id) as total_cargos FROM corporations c ORDER BY c.name;