// TEMPORARY: bootstrap admin user. Delete this file after first use.
import { createFileRoute } from "@tanstack/react-router";

const EMAIL = "ricardo.sarfatti@orizonvr.com.br";
const PASSWORD = "orz#2025%CENUsp012";
const NOME = "Ricardo Sarfatti";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Try to find existing user by email
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) return new Response("listUsers error: " + listErr.message, { status: 500 });

        let user = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());

        if (!user) {
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { nome_completo: NOME },
          });
          if (cErr) return new Response("createUser error: " + cErr.message, { status: 500 });
          user = created.user!;
        } else {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: PASSWORD,
            email_confirm: true,
          });
        }

        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: EMAIL,
              nome_completo: NOME,
              role: "admin",
              ativo: true,
              status_convite: "ativo",
            } as never,
            { onConflict: "id" },
          );
        if (upErr) return new Response("profile upsert error: " + upErr.message, { status: 500 });

        return new Response(
          `OK. Admin pronto.\nEmail: ${EMAIL}\nSenha: (a que voce definiu)\nApague src/routes/api/public/bootstrap-admin.ts agora.`,
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        );
      },
    },
  },
});
