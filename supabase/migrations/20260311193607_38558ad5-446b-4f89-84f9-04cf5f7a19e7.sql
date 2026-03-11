
-- Support conversations table
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Admin can see all conversations
CREATE POLICY "Admin global can manage all support_conversations"
  ON public.support_conversations FOR ALL TO authenticated
  USING (public.is_admin_global());

-- Users can manage own conversations
CREATE POLICY "Users can manage own support_conversations"
  ON public.support_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can see all messages
CREATE POLICY "Admin global can manage all support_messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (public.is_admin_global());

-- Users can manage messages in own conversations
CREATE POLICY "Users can manage own support_messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id AND sc.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = support_messages.conversation_id AND sc.user_id = auth.uid()
  ));

-- Updated_at trigger
CREATE TRIGGER update_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
