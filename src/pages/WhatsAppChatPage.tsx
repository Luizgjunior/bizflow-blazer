import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search, Send, ArrowLeft, MessageSquare, Loader2, MoreVertical, CheckCheck, RefreshCw, Paperclip, X, Image as ImageIcon, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Chat = {
  id: string;
  chatId: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  timestampFormatted: string;
  unreadCount: number;
  isGroup: boolean;
  phone: string;
  image: string;
};

type Message = {
  id: string;
  text: string;
  timestamp: number;
  timestampFormatted: string;
  fromMe: boolean;
  senderName?: string;
  type: string;
};

function formatTs(ts: number): string {
  if (!ts) return '';
  const date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function parseChat(raw: any): Chat {
  const chatId = raw.wa_chatid || raw.id || '';
  const name = raw.wa_contactName || raw.wa_name || raw.name || raw.lead_name || chatId.replace(/@.*/, '');
  const phone = raw.phone || chatId.replace(/@.*/, '');
  const lastMsg = raw.wa_lastMessageTextVote || '';
  const ts = raw.wa_lastMsgTimestamp || 0;
  const unread = raw.wa_unreadCount || 0;
  const isGroup = raw.wa_isGroup || false;
  const image = raw.imagePreview || raw.image || '';

  return {
    id: raw.id || chatId,
    chatId,
    name: name || phone,
    lastMessage: lastMsg,
    timestamp: ts,
    timestampFormatted: formatTs(ts),
    unreadCount: unread,
    isGroup,
    phone,
    image,
  };
}

function parseMessage(raw: any): Message {
  const id = raw.id || raw.key?.id || raw.messageId || Math.random().toString();
  const text = raw.body || raw.message?.conversation || raw.message?.extendedTextMessage?.text
    || raw.text || raw.content || raw.wa_lastMessageTextVote || '';
  const ts = raw.timestamp || raw.messageTimestamp || raw.t || raw.wa_lastMsgTimestamp || 0;
  const fromMe = raw.fromMe ?? raw.key?.fromMe ?? false;
  const senderName = raw.pushName || raw.senderName || raw.notify || '';
  const type = raw.type || raw.messageType || raw.wa_lastMessageType || 'text';

  return {
    id,
    text: typeof text === 'string' ? text : JSON.stringify(text),
    timestamp: ts,
    timestampFormatted: formatTs(ts),
    fromMe,
    senderName,
    type,
  };
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

function getMediaType(file: File): string {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

/* ── Chat List Sidebar ── */
function ChatList({ chats, selectedId, onSelect, loading, searchTerm, onSearchChange, onRefresh }: {
  chats: Chat[];
  selectedId: string | null;
  onSelect: (chat: Chat) => void;
  loading: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
}) {
  const filtered = chats.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-foreground">Conversas</h2>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 text-sm bg-muted/50 border-0"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtered.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelect(chat)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/50 border-b border-border/50 min-h-[64px]",
                selectedId === chat.id && "bg-muted"
              )}
            >
              <Avatar className="w-12 h-12 shrink-0">
                {chat.image && <AvatarImage src={chat.image} />}
                <AvatarFallback className={cn("text-sm text-white font-semibold", getAvatarColor(chat.name))}>
                  {getInitials(chat.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                  <span className={cn(
                    "text-[11px] whitespace-nowrap ml-2",
                    chat.unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground"
                  )}>{chat.timestampFormatted}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate pr-2">{chat.lastMessage || 'Sem mensagens'}</p>
                  {chat.unreadCount > 0 && (
                    <span className="min-w-[20px] h-[20px] rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center px-1 shrink-0">
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

/* ── File Preview ── */
function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  return (
    <div className="relative inline-flex items-center gap-2 bg-muted rounded-lg p-2 pr-8 max-w-[200px]">
      {isImage && preview ? (
        <img src={preview} alt={file.name} className="w-12 h-12 rounded object-cover" />
      ) : (
        <div className="w-12 h-12 rounded bg-muted-foreground/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ── Message View ── */
function MessageView({ chat, messages, loading, onSend, onSendMedia, onBack }: {
  chat: Chat;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onSendMedia: (file: File, caption: string) => Promise<void>;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (sending) return;

    if (selectedFile) {
      setSending(true);
      try {
        await onSendMedia(selectedFile, text.trim());
        setText('');
        setSelectedFile(null);
      } finally {
        setSending(false);
      }
      return;
    }

    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 16MB.');
        return;
      }
      setSelectedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-card min-h-[56px]">
        <button onClick={onBack} className="lg:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-10 h-10">
          {chat.image && <AvatarImage src={chat.image} />}
          <AvatarFallback className={cn("text-xs text-white font-semibold", getAvatarColor(chat.name))}>
            {getInitials(chat.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{chat.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {chat.isGroup ? 'Grupo' : chat.phone}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="p-3 space-y-1 min-h-full flex flex-col justify-end">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 shadow-sm",
                  msg.fromMe
                    ? "bg-primary/15 text-foreground rounded-br-sm"
                    : "bg-card text-foreground rounded-bl-sm border border-border/50"
                )}>
                  {msg.senderName && !msg.fromMe && (
                    <p className="text-[11px] font-semibold text-primary mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text || `[${msg.type}]`}</p>
                  <div className={cn("flex items-center gap-1 mt-1", msg.fromMe ? "justify-end" : "justify-start")}>
                    <span className="text-[10px] text-muted-foreground">{msg.timestampFormatted}</span>
                    {msg.fromMe && <CheckCheck className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File Preview */}
      {selectedFile && (
        <div className="px-3 py-2 border-t border-border bg-card/80">
          <FilePreview file={selectedFile} onRemove={() => setSelectedFile(null)} />
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2 px-2 py-2 border-t border-border bg-card">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          placeholder={selectedFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 h-11 text-sm bg-muted/50 border-0"
        />
        <Button
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={handleSend}
          disabled={(!text.trim() && !selectedFile) || sending}
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
  const selectedChatRef = useRef<Chat | null>(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const fetchChats = useCallback(async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const data = await apiCall('chats');
      if (data.error) {
        if (!silent) toast.error(data.error);
        return;
      }
      const parsed = (data.chats || []).map(parseChat);
      parsed.sort((a: Chat, b: Chat) => (b.timestamp || 0) - (a.timestamp || 0));
      setChats(parsed);
    } catch (err: any) {
      if (!silent) toast.error(err.message || 'Erro ao carregar conversas');
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, []);

  const fetchMessages = useCallback(async (chatId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await apiCall('messages', { chatId, count: 100 });
      if (data.error) {
        if (!silent) toast.error(data.error);
        return;
      }
      const parsed = (data.messages || []).map(parseMessage);
      parsed.sort((a: Message, b: Message) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(parsed);
    } catch (err: any) {
      if (!silent) toast.error(err.message || 'Erro ao carregar mensagens');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Polling: chat list every 15s
  useEffect(() => {
    const interval = setInterval(() => fetchChats(true), 15000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // Polling: messages every 5s when chat selected
  useEffect(() => {
    if (!selectedChat) return;
    const interval = setInterval(() => {
      const current = selectedChatRef.current;
      if (current) fetchMessages(current.chatId, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedChat, fetchMessages]);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.chatId);
  };

  const handleSend = async (text: string) => {
    if (!selectedChat) return;
    try {
      const data = await apiCall('send', { chatId: selectedChat.chatId, message: text });
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const newMsg: Message = {
        id: Date.now().toString(),
        text,
        timestamp: Date.now(),
        timestampFormatted: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fromMe: true,
        type: 'text',
      };
      setMessages(prev => [...prev, newMsg]);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    }
  };

  const handleSendMedia = async (file: File, caption: string) => {
    if (!selectedChat) return;
    try {
      // Upload file to storage bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file);

      if (uploadError) {
        toast.error('Erro ao fazer upload do arquivo');
        console.error('Upload error:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;
      const mediaType = getMediaType(file);

      const data = await apiCall('sendMedia', {
        chatId: selectedChat.chatId,
        mediaUrl,
        mediaType,
        caption,
      });

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const newMsg: Message = {
        id: Date.now().toString(),
        text: caption || `[${mediaType}] ${file.name}`,
        timestamp: Date.now(),
        timestampFormatted: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fromMe: true,
        type: mediaType,
      };
      setMessages(prev => [...prev, newMsg]);
      toast.success('Mídia enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mídia');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">WhatsApp Chat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize e responda conversas em tempo real.
          </p>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card" style={{ height: 'calc(100vh - 180px)', minHeight: '400px' }}>
          <div className="flex h-full">
            {/* Sidebar */}
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
                onRefresh={() => fetchChats(false)}
              />
            </div>

            {/* Messages */}
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
                    onSendMedia={handleSendMedia}
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
