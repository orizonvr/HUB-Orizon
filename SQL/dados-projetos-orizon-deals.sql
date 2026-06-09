-- =============================================================
-- Dados — 51 projetos (origem: projetos_orizon_dataverse.csv)
-- Rodar DEPOIS do schema-orizon-deals.sql, no SQL Editor do orizon-deals.
-- Mapeamentos aplicados:
--   Tipo:        M&A -> 'ma'  |  Novos Negócios -> 'novos_negocios'
--   Estágio:     rótulo do CSV -> chave interna do app (ex: SPA -> assinatura_spa)
--   Subcategoria: rótulo -> chave (ex: Biometano -> biometano); M&A -> NULL
--   setor/responsavel/lider ficam NULL (não vêm no CSV); status = 'ativo'
-- Reexecução: descomente o DELETE abaixo para recarregar do zero.
-- =============================================================

-- DELETE FROM public.projetos;  -- (opcional) limpar antes de reimportar

INSERT INTO public.projetos (tipo, nome, contraparte, subcategoria, estagio, status_detalhado, status) VALUES
('ma','Rondonópolis','Rondonópolis',NULL,'assinatura_spa','Assinatura do SPA','ativo'),
('ma','Conchal','Conchal',NULL,'due_diligence','Due Diligence','ativo'),
('ma','Marca Ambiental','Marca Ambiental',NULL,'elaborando_nbo','Elaborando NBO','ativo'),
('ma','Estre','Estre',NULL,'analise_inicial','Análise Inicial','ativo'),
('ma','Minoritários','Minoritários',NULL,'analise_inicial','Análise Inicial','ativo'),
('ma','Dois Arcos','Dois Arcos',NULL,'nbo_submetida','NBO elaborada, aguardando definição seller','ativo'),
('ma','Rio das Pedras','Rio das Pedras',NULL,'nbo_submetida','NBO submetida / Desidratação','ativo'),
('ma','Mossoró','Mossoró',NULL,'negociacao','Possivel opção de compra via dívida vencida','ativo'),
('ma','Macapá','Macapá',NULL,'opcao_compra_assinada','Opção de Compra Assinada','ativo'),
('ma','Seiva','Seiva',NULL,'nda_preenchimento','NDA em preenchimento','ativo'),
('ma','Ambientis','Ambientis',NULL,'nda_assinado','NDA assinado / Possível nova NBO','ativo'),
('ma','Napa','Napa',NULL,'negociacao','Negociação Iniciais','ativo'),
('ma','CETRIC','CETRIC',NULL,'elaborando_nbo','Validar modelagem para seguir com NBO','ativo'),
('ma','RENOVA','RENOVA',NULL,'analise_inicial','Avaliar modelo societário para seguirmos','ativo'),
('ma','Terreno Cajamar','Terreno Cajamar',NULL,'analise_inicial','Kickoff proxima semana','ativo'),
('novos_negocios','Biometano São Gonçalo','Biometano São Gonçalo','biometano','discussoes_offtaker','Em negociação de offtaker (Fornecedor/Financiamento avançado)','ativo'),
('novos_negocios','Biometano Nova Iguaçú','Biometano Nova Iguaçú','biometano','discussoes_offtaker','Em negociação de offtaker (Fornecedor/Financiamento avançado)','ativo'),
('novos_negocios','URE Barueri','URE Barueri','waste_to_energy','operacao','Acompanhamento e análise do realizado','ativo'),
('novos_negocios','Carregador URE Barueri','Carregador URE Barueri','waste_to_energy','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','CDR Sorocaba','CDR Sorocaba','economia_circular','analise_viabilidade','Criação de Simulador de Receita x Custo','ativo'),
('novos_negocios','CDR Jaboatao','CDR Jaboatao','economia_circular','analise_viabilidade','Criação de Simulador de Receita x Custo','ativo'),
('novos_negocios','Boa Vista','Boa Vista','licitacoes_ppps','analise_viabilidade','Estudo avançado (aguardando retorno município)','ativo'),
('novos_negocios','CIRSOP','CIRSOP','licitacoes_ppps','analise_viabilidade','Modelagem para Proposta e Acompanhamento','ativo'),
('novos_negocios','Caxias do Sul','Caxias do Sul','licitacoes_ppps','analise_viabilidade','Em estudo','ativo'),
('novos_negocios','Leilão de Bateria Paulinía','Leilão de Bateria Paulinía','energia','analise_viabilidade','Análises iniciais de retorno','ativo'),
('novos_negocios','Leilão de Bateria Joboatão','Leilão de Bateria Joboatão','energia','analise_viabilidade','Análises iniciais de retorno','ativo'),
('novos_negocios','Leilão de Bateria João Pessoa','Leilão de Bateria João Pessoa','energia','analise_viabilidade','Análises iniciais de retorno','ativo'),
('novos_negocios','JAB II (Biometano)','JAB II (Biometano)','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Venda gás Rosario do Catete','Venda gás Rosario do Catete','biometano','analise_viabilidade','Análise de viabilidade vs construir biometano','ativo'),
('novos_negocios','Venda gás Maceio','Venda gás Maceio','biometano','analise_viabilidade','Análise de viabilidade vs construir biometano','ativo'),
('novos_negocios','Venda gás João Pessoa','Venda gás João Pessoa','biometano','analise_viabilidade','Análise de viabilidade vs construir biometano','ativo'),
('novos_negocios','CO2 Jaboatão','CO2 Jaboatão','co2','discussoes_offtaker','Discussões com offtaker avançadas','ativo'),
('novos_negocios','CO2 Itapevi','CO2 Itapevi','co2','discussoes_offtaker','Discussões com offtaker avançadas','ativo'),
('novos_negocios','Retrofit Paulinia','Retrofit Paulinia','economia_circular','analise_viabilidade','Modelagem Financeira de viabilidade','ativo'),
('ma','Presidente Prudente','Presidente Prudente',NULL,'pos_ma_integracao','Acompanhemento integração, resulado e earnout','ativo'),
('novos_negocios','Juiz de Fora - Planta de biometano','Juiz de Fora - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Macaubas - Planta de biometano','Macaubas - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Ecourbis - Planta de biometano','Ecourbis - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Ipatinga - Planta de biometano','Ipatinga - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Titara - Planta de biometano','Titara - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Campos - Planta de biometano','Campos - Planta de biometano','biometano','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','UTM Ecourbis (1)','UTM Ecourbis (1)','economia_circular','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','UTM Ecourbis (2)','UTM Ecourbis (2)','economia_circular','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','UTM Ecourbis (3)','UTM Ecourbis (3)','economia_circular','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','UTM Angra (1)','UTM Angra (1)','economia_circular','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','WTE Ecourbis (1)','WTE Ecourbis (1)','waste_to_energy','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','WTE Ecourbis (2)','WTE Ecourbis (2)','waste_to_energy','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Pirapora','Pirapora','aterros_greenfield','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Viamao','Viamao','aterros_greenfield','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','Colômbia','Colômbia','aterros_greenfield','analise_viabilidade','Análise de viabilidade','ativo'),
('novos_negocios','São João del Rey','São João del Rey','aterros_greenfield','analise_viabilidade','Análise de viabilidade','ativo');

-- Conferência rápida:
-- SELECT tipo, count(*) FROM public.projetos GROUP BY tipo;   -- deve dar ma=15, novos_negocios=36
-- SELECT count(*) FROM public.projetos;                       -- deve dar 51
