# Dados no Site (Postgres)
- Feitas: aparelhos, celular_contatos, celular_mensagens, deepweb_posts.
- Planejadas (doc): aparelho_donos, conversas/conversa_membros, mensagens(pos/rua), notas, fotos(cena jsonb), olx_anuncios/olx_vendas, jornal_materias, chamados/central_turnos, pericia_acessos/inqueritos.
- Migração idempotente no boot (CREATE IF NOT EXISTS). Ver [[DataHandler]] e `D:\T2\src\db\migrate.js`.
