// TEMPORARY: reset password for Renan Di Pardi. Delete this file after use.
import { createFileRoute } from "@tanstack/react-router";

const EMAIL = "renan.dipardi@orizonvr.com.br";
const NEW_PASSWORD = "Orz-Temp!7fQ2xL9kP3vR";

export const Route = createFileRoute("/api/public/reset-renan")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 500,
        });
        if (listErr) return new Response("listUsers error: " + listErr.message, { status: 500 });

        const user = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
        if (!user) return new Response("Usuário não encontrado: " + EMAIL, { status: 404 });

        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: NEW_PASSWORD,
          email_confirm: true,
        });
        if (uErr) return new Response("updateUser error: " + uErr.message, { status: 500 });

        return new Response(
          `OK. Senha redefinida.\nEmail: ${EMAIL}\nSenha temporária: ${NEW_PASSWORD}\n\nApague src/routes/api/public/reset-renan.ts agora.`,
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        );
      },
    },
  },
});
