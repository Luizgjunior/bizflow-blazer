import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search, Send, ArrowLeft, MessageSquare, Loader2, Phone, Video, MoreVertical, Smile, Paperclip, Check, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Chat = {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  phone: string;
};

type Message = {
  id: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  senderName?: string;
  type: string;
};

function parseChat(raw: any): Chat {
  const id = raw.id || raw.jid || raw.chatId || '';
  const name = raw.name || raw.pushName || raw.notify || raw.contact?.name || id.replace(/@.*/, '');
  const lastMsg = raw.lastMessage?.body || raw.lastMessage?.message?.conversation || raw.lastMessage?.text || raw.msg || '';
  const ts = raw.lastMessage?.timestamp || raw.timestamp || raw.t || 0;
  const unread = raw.unreadCount || raw.unread || raw.count || 0;
  const isGroup = id.includes('@g.us');
  const phone = id.replace(/@.*/, '');

  return {
    id,
    name: name || phone,
    lastMessage: typeof lastMsg === 'string' ? lastMsg : '',
    timestamp: ts ? formatTimestamp(ts) : '',
    unreadCount: unread,
    isGroup,
    phone,
  };
}

function parseMessage(raw: any): Message {
  const id = raw.id || raw.key?.id || raw.messageId || Math.random().toString();
  const text = raw.body || raw.message?.conversation || raw.message?.extendedTextMessage?.text || raw.text || raw.content || '';
  const ts = raw.timestamp || raw.messageTimestamp || raw.t || 0;
  const fromMe = raw.fromMe ?? raw.key?.fromMe ?? false;
  const senderName = raw.pushName || raw.senderName || raw.notify || '';
  const type = raw.type || raw.messageType || 'text';

  return { id, text: typeof text === 'string' ? text : JSON.stringify(text), timestamp: formatTimestamp(ts), fromMe, senderName, type };
}

function formatTimestamp(ts: number | string): string {
  if (!ts) return '';
  const date = typeof ts === 'number' 
    ? (ts > 1e12 ? new Date(ts) : new Date(ts * 1000)) 
    : new Date(ts);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

const colorPalette = [
  'bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600',
  'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-pink-600', 'bg-cyan-600',
];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

async function apiCall(action: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-chats?action=${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

/* ── Chat List Sidebar ── */
function ChatList({ chats, selectedId, onSelect, loading, searchTerm, onSearchChange }: {
  chats: Chat[];
  selectedId: string | null;
  onSelect: (chat: Chat) => void;
  loading: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = chats.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground mb-2">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtered.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelect(chat)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50",
                selectedId === chat.id && "bg-muted"
              )}
            >
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className={cn("text-xs text-white font-semibold", getAvatarColor(chat.name))}>
                  {getInitials(chat.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{chat.timestamp}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || 'Sem mensagens'}</p>
                  {chat.unreadCount > 0 && (
                    <span className="ml-2 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Message View ── */
function MessageView({ chat, messages, loading, onSend, onBack }: {
  chat: Chat;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-9 h-9">
          <AvatarFallback className={cn("text-xs text-white font-semibold", getAvatarColor(chat.name))}>
            {getInitials(chat.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{chat.name}</p>
          <p className="text-[10px] text-muted-foreground">{chat.phone}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-[hsl(var(--muted)/0.3)]">
        <div className="p-4 space-y-1 min-h-full flex flex-col justify-end">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-xs">Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.fromMe ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                    msg.fromMe
                      ? "bg-primary/15 text-foreground rounded-br-sm"
                      : "bg-card text-foreground rounded-bl-sm border border-border/50"
                  )}
                >
                  {msg.senderName && !msg.fromMe && (
                    <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text || `[${msg.type}]`}</p>
                  <div className={cn("flex items-center gap-1 mt-1", msg.fromMe ? "justify-end" : "justify-start")}>
                    <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                    {msg.fromMe && <CheckCheck className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-card">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground shrink-0">
          <Smile className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground shrink-0">
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 h-9 text-sm bg-muted/50 border-0"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function WhatsAppChatPage() {
  useDocumentTitle('WhatsApp Chat');

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const data = await apiCall('chats');
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const parsed = (data.chats || []).map(parseChat);
      // Sort: most recent first
      parsed.sort((a: Chat, b: Chat) => {
        if (!a.timestamp && !b.timestamp) return 0;
        return b.timestamp.localeCompare(a.timestamp);
      });
      setChats(parsed);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar conversas');
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiCall('messages', { chatId, count: 100 });
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const parsed = (data.messages || []).map(parseMessage);
      setMessages(parsed);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const handleSend = async (text: string) => {
    if (!selectedChat) return;
    try {
      const data = await apiCall('send', { chatId: selectedChat.id, message: text });
      if (data.error) {
        toast.error(data.error);
        return;
      }
      // Add optimistic message
      const newMsg: Message = {
        id: Date.now().toString(),
        text,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fromMe: true,
        type: 'text',
      };
      setMessages(prev => [...prev, newMsg]);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">WhatsApp Chat</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize e responda conversas do seu WhatsApp conectado.
          </p>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          <div className="flex h-full">
            {/* Sidebar - Chat list */}
            <div className={cn(
              "w-full lg:w-80 xl:w-96 border-r border-border h-full",
              selectedChat ? "hidden lg:flex lg:flex-col" : "flex flex-col"
            )}>
              <ChatList
                chats={chats}
                selectedId={selectedChat?.id || null}
                onSelect={handleSelectChat}
                loading={loadingChats}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>

            {/* Main - Messages */}
            <div className={cn(
              "flex-1 h-full",
              !selectedChat ? "hidden lg:flex" : "flex"
            )}>
              {selectedChat ? (
                <div className="flex flex-col w-full h-full">
                  <MessageView
                    chat={selectedChat}
                    messages={messages}
                    loading={loadingMessages}
                    onSend={handleSend}
                    onBack={() => setSelectedChat(null)}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">Selecione uma conversa</p>
                  <p className="text-xs mt-1">Escolha um chat ao lado para ver as mensagens</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
