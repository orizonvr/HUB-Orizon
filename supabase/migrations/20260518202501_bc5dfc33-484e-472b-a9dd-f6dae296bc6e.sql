ALTER TABLE public.projetos
  ADD COLUMN volume_ton_dia numeric,
  ADD COLUMN percentual_orizon numeric,
  ADD COLUMN valor_transacao_mm numeric,
  ADD COLUMN notas_estrategicas text;

ALTER TABLE public.projetos
  ADD CONSTRAINT percentual_orizon_range
  CHECK (percentual_orizon IS NULL OR (percentual_orizon >= 0 AND percentual_orizon <= 100));