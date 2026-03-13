import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Leadzinho, o assistente virtual inteligente do LeadFlow Intelligence — uma plataforma de prospecção B2B, automação de WhatsApp e CRM.

Seu papel é ajudar os usuários com dúvidas sobre o sistema de forma simpática, objetiva e profissional. Sempre responda em português brasileiro.

Funcionalidades do sistema que você conhece:
- **ICPs (Perfil de Cliente Ideal)**: Criação de perfis com filtros (CNAE, UF, município, porte, capital social) para buscar leads
- **Runs (Execuções)**: Processar buscas de leads baseadas em ICPs configurados
- **Leads**: Visualização, filtragem por score, notas, tags e exportação CSV
- **Exports**: Exportação de leads em CSV para uso em planilhas e CRMs
- **Automação**: Agendamento de execuções automáticas (diária, semanal, mensal)
- **Conexão WhatsApp**: Vincular número via QR Code para disparos e chat
- **Disparos**: Campanhas de mensagens em massa via WhatsApp com delays de proteção
- **Chat WhatsApp**: Conversas em tempo real com leads pela plataforma
- **CRM Kanban**: Pipeline visual com drag & drop para gerenciar negociações
- **CRM Dashboard**: Métricas de vendas, funil, taxa de conversão e previsão de receita

Planos disponíveis:
- Pro (R$ 97/mês): 6.000 leads/mês
- Premium (R$ 197/mês): 14.000 leads/mês, WhatsApp
- Enterprise (R$ 297/mês): 32.000 leads/mês, WhatsApp, Webhooks

Regras:
- Seja breve e direto, use listas quando apropriado
- Se não souber algo específico, oriente o usuário a entrar em contato com o suporte humano
- Nunca invente funcionalidades que não existem
- Use emojis com moderação para tornar a conversa mais amigável
- Não revele detalhes técnicos internos (banco de dados, APIs, etc.)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Auth user
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversation_id } = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    let convId = conversation_id;

    // Get user tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Create conversation if needed
    if (!convId) {
      const { data: conv, error: convError } = await supabaseAdmin
        .from("support_conversations")
        .insert({ user_id: user.id, tenant_id: profile?.tenant_id })
        .select("id")
        .single();
      if (convError) throw convError;
      convId = conv.id;
    }

    // Save user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await supabaseAdmin.from("support_messages").insert({
        conversation_id: convId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    // Update conversation timestamp
    await supabaseAdmin
      .from("support_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    // We need to intercept the stream to save the full response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    let fullResponse = "";

    (async () => {
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          
          // Extract content from SSE for saving
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullResponse += content;
              } catch {}
            }
          }

          await writer.write(value);
        }
      } finally {
        await writer.close();
        // Save assistant response after stream completes
        if (fullResponse) {
          await supabaseAdmin.from("support_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: fullResponse,
          });
        }
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Conversation-Id": convId,
      },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
