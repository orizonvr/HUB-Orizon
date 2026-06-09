-- Tabela comites
CREATE TABLE public.comites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  data timestamp with time zone NOT NULL,
  participante_ids uuid[] NOT NULL DEFAULT '{}',
  criado_por_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'preparacao' CHECK (status IN ('preparacao', 'realizado', 'cancelado')),
  ata_consolidada text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_comites_data ON public.comites(data);
CREATE INDEX idx_comites_participantes ON public.comites USING GIN(participante_ids);

CREATE TRIGGER trg_comites_updated_at
  BEFORE UPDATE ON public.comites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comites ENABLE ROW LEVEL SECURITY;

-- Tabela comite_pauta
CREATE TABLE public.comite_pauta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comite_id uuid NOT NULL REFERENCES public.comites(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  relator_id uuid REFERENCES public.profiles(id),
  briefing_snapshot jsonb,
  decisao text DEFAULT 'pendente' CHECK (decisao IN ('aprovado', 'aprovado_com_ressalvas', 'reprovado', 'adiado', 'pendente')),
  justificativa text,
  condicionantes text,
  estagio_sugerido text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (comite_id, projeto_id)
);

CREATE INDEX idx_comite_pauta_comite ON public.comite_pauta(comite_id);
CREATE INDEX idx_comite_pauta_projeto ON public.comite_pauta(projeto_id);

CREATE TRIGGER trg_comite_pauta_updated_at
  BEFORE UPDATE ON public.comite_pauta
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comite_pauta ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES comites =====
CREATE POLICY comites_select ON public.comites
  FOR SELECT TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        auth.uid() = ANY(participante_ids)
        OR criado_por_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comite_pauta cp
          JOIN public.projetos p ON p.id = cp.projeto_id
          WHERE cp.comite_id = comites.id AND p.responsavel_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comites_insert ON public.comites
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_id = auth.uid()
    AND app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role, 'analista'::user_role)
  );

CREATE POLICY comites_update ON public.comites
  FOR UPDATE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (app_private.current_user_role() = 'analista'::user_role AND criado_por_id = auth.uid())
  )
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (app_private.current_user_role() = 'analista'::user_role AND criado_por_id = auth.uid())
  );

CREATE POLICY comites_delete ON public.comites
  FOR DELETE TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role);

-- ===== POLICIES comite_pauta =====
CREATE POLICY comite_pauta_select ON public.comite_pauta
  FOR SELECT TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id
            AND (auth.uid() = ANY(c.participante_ids) OR c.criado_por_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.projetos p
          WHERE p.id = comite_pauta.projeto_id AND p.responsavel_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comite_pauta_insert ON public.comite_pauta
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role, 'analista'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.comites c
      WHERE c.id = comite_pauta.comite_id AND c.status = 'preparacao'
    )
  );

CREATE POLICY comite_pauta_update ON public.comite_pauta
  FOR UPDATE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        relator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id AND c.criado_por_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        relator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id AND c.criado_por_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comite_pauta_delete ON public.comite_pauta
  FOR DELETE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.comites c
      WHERE c.id = comite_pauta.comite_id AND c.status = 'preparacao'
    )
  );