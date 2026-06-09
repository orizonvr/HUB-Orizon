ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS estagio_valido;

ALTER TABLE public.projetos ADD CONSTRAINT estagio_valido CHECK (
  (tipo = 'ma' AND estagio IN (
    'analise_inicial','nda_preenchimento','nda_assinado','elaborando_nbo',
    'nbo_submetida','due_diligence','negociacao','opcao_compra_assinada',
    'assinatura_spa','pos_ma_integracao'
  ))
  OR
  (tipo = 'novos_negocios' AND estagio IN (
    'analise_viabilidade','discussoes_offtaker','negociacao',
    'aprovacao_comite','implementacao','operacao'
  ))
);