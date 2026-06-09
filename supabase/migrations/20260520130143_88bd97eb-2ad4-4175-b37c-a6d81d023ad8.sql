-- Recreate FKs to profiles(id) with ON UPDATE CASCADE so the
-- handle_new_user trigger can repoint a placeholder profile's id
-- to the new auth user id without violating FK constraints.

ALTER TABLE public.convites
  DROP CONSTRAINT convites_profile_id_fkey,
  ADD CONSTRAINT convites_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.convites
  DROP CONSTRAINT convites_criado_por_fkey,
  ADD CONSTRAINT convites_criado_por_fkey
    FOREIGN KEY (criado_por) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.projetos
  DROP CONSTRAINT projetos_responsavel_id_fkey,
  ADD CONSTRAINT projetos_responsavel_id_fkey
    FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.projetos
  DROP CONSTRAINT projetos_lider_id_fkey,
  ADD CONSTRAINT projetos_lider_id_fkey
    FOREIGN KEY (lider_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.comentarios
  DROP CONSTRAINT comentarios_autor_id_fkey,
  ADD CONSTRAINT comentarios_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.documentos
  DROP CONSTRAINT documentos_enviado_por_fkey,
  ADD CONSTRAINT documentos_enviado_por_fkey
    FOREIGN KEY (enviado_por) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.atividades
  DROP CONSTRAINT atividades_autor_id_fkey,
  ADD CONSTRAINT atividades_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;