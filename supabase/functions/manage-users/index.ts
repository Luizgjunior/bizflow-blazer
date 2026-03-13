import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin_global
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } =
      await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: claimsData.claims.sub,
      _role: "admin_global",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, nome, tenant_id, role } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createUserPayload: any = {
        email,
        email_confirm: true,
        user_metadata: {
          nome: nome || email.split("@")[0],
          empresa_nome: nome || email.split("@")[0],
          plano: "pro",
        },
      };

      if (password) {
        createUserPayload.password = password;
      }

      // Create user
      const { data: authUser, error: authError } =
        await adminClient.auth.admin.createUser(createUserPayload);

      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Wait for trigger to create profile
      await new Promise((r) => setTimeout(r, 1500));

      // Update profile with tenant if specified
      if (tenant_id) {
        await adminClient
          .from("profiles")
          .update({ tenant_id, nome: nome || email.split("@")[0] })
          .eq("id", authUser.user.id);
      }

      // Update role if specified
      if (role && role !== "empresa") {
        // The trigger creates 'empresa' by default, update if different
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", authUser.user.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: authUser.user.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "update") {
      const { user_id, nome, tenant_id, role } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const updates: Record<string, any> = {};
      if (nome !== undefined) updates.nome = nome;
      if (tenant_id !== undefined) updates.tenant_id = tenant_id;

      if (Object.keys(updates).length > 0) {
        await adminClient.from("profiles").update(updates).eq("id", user_id);
      }

      // Update role
      if (role) {
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (existingRole) {
          await adminClient
            .from("user_roles")
            .update({ role })
            .eq("user_id", user_id);
        } else {
          await adminClient
            .from("user_roles")
            .insert({ user_id, role });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-users error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
