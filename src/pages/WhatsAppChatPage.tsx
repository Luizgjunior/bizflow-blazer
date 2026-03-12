import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Search, Send, ArrowLeft, MessageSquare, Loader2, MoreVertical, CheckCheck, RefreshCw, Paperclip, X, Image as ImageIcon, FileText, Play, Trash2,
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
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mimetype?: string;
  messageid?: string;
  needsProxy?: boolean;
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
  // UazAPI v2 returns: wa_chatid, phone, wa_contactName, wa_name, name, lead_name, etc.
  const chatId = raw.wa_chatid || raw.chatid || raw.id || '';
  const phone = raw.phone || chatId.replace(/@.*/, '');
  const name = raw.wa_contactName || raw.wa_name || raw.name || raw.lead_name || raw.lead_fullName || phone;
  const lastMsg = raw.wa_lastMessageTextVote || raw.lastMessage || '';
  const ts = raw.wa_lastMsgTimestamp || raw.timestamp || raw.t || 0;
  const unread = raw.wa_unreadCount || raw.unreadCount || 0;
  const isGroup = raw.wa_isGroup || raw.isGroup || (chatId.includes('@g.us')) || false;
  const image = raw.imagePreview || raw.image || '';

  // Build chatId from phone if not available
  const finalChatId = chatId || (phone ? `${phone}@s.whatsapp.net` : '');

  return {
    id: raw.id || finalChatId || phone,
    chatId: finalChatId,
    name: name || phone || 'Desconhecido',
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
  const ts = raw.timestamp || raw.messageTimestamp || raw.t || raw.wa_lastMsgTimestamp || 0;
  const fromMe = raw.fromMe ?? raw.key?.fromMe ?? false;
  const senderName = raw.pushName || raw.senderName || raw.notify || '';
  const type = raw.type || raw.messageType || raw.wa_lastMessageType || 'text';
  const messageid = raw.messageid || raw.messageId || raw.key?.id || '';

  // Extract text carefully — avoid falling through to raw.content which can be a huge base64 object
  let text = '';
  if (typeof raw.body === 'string' && raw.body) {
    text = raw.body;
  } else if (raw.message?.conversation) {
    text = raw.message.conversation;
  } else if (raw.message?.extendedTextMessage?.text) {
    text = raw.message.extendedTextMessage.text;
  } else if (typeof raw.text === 'string' && raw.text) {
    text = raw.text;
  } else if (typeof raw.content === 'string' && raw.content) {
    text = raw.content;
  } else if (raw.content && typeof raw.content === 'object') {
    // Media message — extract caption if available, otherwise show type label
    text = raw.content.caption || raw.content.text || '';
  } else if (raw.wa_lastMessageTextVote) {
    text = raw.wa_lastMessageTextVote;
  }

  // Map message types to friendly labels when no text
  const mediaTypeLabels: Record<string, string> = {
    ImageMessage: '📷 Imagem',
    VideoMessage: '🎥 Vídeo',
    AudioMessage: '🎵 Áudio',
    StickerMessage: '🏷️ Sticker',
    DocumentMessage: '📄 Documento',
    ContactMessage: '👤 Contato',
    LocationMessage: '📍 Localização',
    PollCreationMessage: '📊 Enquete',
  };

  if (!text && type && mediaTypeLabels[type]) {
    text = mediaTypeLabels[type];
  }

  // Determine media type from message type
  let mediaType: Message['mediaType'];
  let mimetype: string | undefined;
  const content = raw.content && typeof raw.content === 'object' ? raw.content : {};
  const fileURL = raw.fileURL || '';
  const contentURL = content.URL || '';
  mimetype = content.mimetype || '';

  const isMediaMessage = ['ImageMessage', 'VideoMessage', 'AudioMessage', 'DocumentMessage', 'StickerMessage'].includes(type);

  if (type === 'ImageMessage' || type === 'StickerMessage') mediaType = 'image';
  else if (type === 'VideoMessage') mediaType = 'video';
  else if (type === 'AudioMessage') mediaType = 'audio';
  else if (type === 'DocumentMessage') mediaType = 'document';
  else if (mimetype) {
    if (mimetype.startsWith('image/')) mediaType = 'image';
    else if (mimetype.startsWith('video/')) mediaType = 'video';
    else if (mimetype.startsWith('audio/')) mediaType = 'audio';
    else if (isMediaMessage) mediaType = 'document';
  }

  // Determine media URL - prefer fileURL (non-encrypted), check if contentURL is encrypted
  let mediaUrl: string | undefined;
  let needsProxy = false;

  if (fileURL && typeof fileURL === 'string' && fileURL.startsWith('http')) {
    mediaUrl = fileURL;
  } else if (contentURL && typeof contentURL === 'string' && contentURL.startsWith('http')) {
    // Check if URL is encrypted (.enc in path)
    if (contentURL.includes('.enc') || content.mediaKey) {
      // Encrypted media - needs proxy download
      needsProxy = true;
      mediaUrl = undefined; // Will be loaded via proxy
    } else {
      mediaUrl = contentURL;
    }
  } else if (isMediaMessage && messageid) {
    // No URL available but it's a media message - try proxy
    needsProxy = true;
  }

  return {
    id,
    text,
    timestamp: ts,
    timestampFormatted: formatTs(ts),
    fromMe,
    senderName,
    type,
    mediaUrl,
    mediaType,
    mimetype,
    messageid,
    needsProxy,
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

async function fetchMediaBlob(messageid: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-chats?action=getMedia`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageid }),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return null; // Error response
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/* ── Media Content Component (handles proxy loading) ── */
function MediaContent({ msg, onLightbox }: { msg: Message; onLightbox: (url: string) => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (msg.needsProxy && msg.messageid && !msg.mediaUrl && !blobUrl && !loading && !failed) {
      setLoading(true);
      fetchMediaBlob(msg.messageid).then(url => {
        if (url) {
          setBlobUrl(url);
        } else {
          setFailed(true);
        }
        setLoading(false);
      });
    }
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [msg.needsProxy, msg.messageid, msg.mediaUrl]);

  const url = msg.mediaUrl || blobUrl;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 mb-1.5 min-w-[200px]">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando mídia...</span>
      </div>
    );
  }

  if (!url && failed) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 mb-1.5">
        <Play className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Mídia indisponível</span>
      </div>
    );
  }

  if (!url) return null;

  if (msg.mediaType === 'image') {
    return (
      <button onClick={() => onLightbox(url)} className="block mb-1.5 rounded-md overflow-hidden max-w-[280px] hover:opacity-90 transition-opacity">
        <img src={url} alt="Imagem" className="w-full h-auto rounded-md" loading="lazy" />
      </button>
    );
  }

  if (msg.mediaType === 'video') {
    return (
      <div className="mb-1.5 rounded-md overflow-hidden max-w-[280px]">
        <video src={url} controls className="w-full h-auto rounded-md" preload="metadata" />
      </div>
    );
  }

  if (msg.mediaType === 'audio') {
    return (
      <div className="mb-1.5 min-w-[200px]">
        <audio src={url} controls className="w-full h-10" preload="metadata" />
      </div>
    );
  }

  if (msg.mediaType === 'document') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 mb-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors">
        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="text-xs text-primary underline truncate">Abrir documento</span>
      </a>
    );
  }

  return null;
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
function MessageView({ chat, messages, loading, onSend, onSendMedia, onBack, onDelete }: {
  chat: Chat;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onSendMedia: (file: File, caption: string) => Promise<void>;
  onBack: () => void;
  onDelete: (messageid: string) => void;
}) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
              <div key={msg.id} className={cn("flex group", msg.fromMe ? "justify-end" : "justify-start")}>
                <div className="flex items-center gap-1">
                  {msg.fromMe && msg.messageid && (
                    <button
                      onClick={() => onDelete(msg.messageid!)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Apagar mensagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 shadow-sm overflow-hidden",
                    msg.fromMe
                      ? "bg-primary/15 text-foreground rounded-br-sm"
                      : "bg-card text-foreground rounded-bl-sm border border-border/50"
                  )}>
                    {msg.senderName && !msg.fromMe && (
                      <p className="text-[11px] font-semibold text-primary mb-0.5">{msg.senderName}</p>
                    )}

                    {/* Media content */}
                    {(msg.mediaUrl || msg.needsProxy) && msg.mediaType && (
                      <MediaContent msg={msg} onLightbox={setLightboxUrl} />
                    )}

                    {(() => {
                      const hasMedia = msg.mediaUrl || msg.needsProxy;
                      const isMediaLabel = hasMedia && /^(📷 Imagem|🎥 Vídeo|🎵 Áudio|📄 Documento|🏷️ Sticker)$/.test(msg.text);
                      if (msg.text && !isMediaLabel) {
                        return <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{msg.text}</p>;
                      } else if (!hasMedia) {
                        return <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{msg.text || `[${msg.type}]`}</p>;
                      }
                      return null;
                    })()}

                    <div className={cn("flex items-center gap-1 mt-1", msg.fromMe ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] text-muted-foreground">{msg.timestampFormatted}</span>
                      {msg.fromMe && <CheckCheck className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                  {!msg.fromMe && msg.messageid && (
                    <button
                      onClick={() => onDelete(msg.messageid!)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Apagar mensagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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

      {/* Image Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 bg-background/95 backdrop-blur-sm">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Imagem ampliada" className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
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

  // Auto-create CRM deals for new WhatsApp contacts
  const autoCreateDealsRef = useRef(false);
  useEffect(() => {
    if (chats.length === 0 || autoCreateDealsRef.current) return;
    autoCreateDealsRef.current = true;

    const createDealsForNewContacts = async () => {
      try {
        // Get first pipeline stage for this tenant
        const { data: stages } = await supabase
          .from('crm_pipeline_stages')
          .select('id, tenant_id')
          .order('posicao')
          .limit(1);

        if (!stages || stages.length === 0) return;
        const firstStage = stages[0];

        // Get existing deals' phone numbers
        const { data: existingDeals } = await supabase
          .from('crm_deals')
          .select('telefone');

        const existingPhones = new Set((existingDeals || []).map(d => d.telefone).filter(Boolean));

        // Create deals for contacts that don't have one yet (non-group only)
        const newContacts = chats.filter(c => !c.isGroup && c.phone && !existingPhones.has(c.phone));

        if (newContacts.length === 0) return;

        const inserts = newContacts.slice(0, 50).map(c => ({
          tenant_id: firstStage.tenant_id,
          stage_id: firstStage.id,
          titulo: c.name || c.phone,
          telefone: c.phone,
          contato_nome: c.name || null,
        }));

        await supabase.from('crm_deals').insert(inserts);

        // Log activities
        const { data: newDeals } = await supabase
          .from('crm_deals')
          .select('id, tenant_id')
          .in('telefone', inserts.map(i => i.telefone));

        if (newDeals && newDeals.length > 0) {
          const actInserts = newDeals.map(d => ({
            deal_id: d.id,
            tenant_id: d.tenant_id,
            tipo: 'whatsapp',
            descricao: 'Deal criado automaticamente via WhatsApp',
          }));
          await supabase.from('crm_deal_activities').insert(actInserts);
        }
      } catch (err) {
        console.error('Auto-create deals error:', err);
      }
    };

    createDealsForNewContacts();
  }, [chats]);

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
    // Mark as read silently
    apiCall('markRead', { chatId: chat.chatId }).catch(() => {});
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

  const handleDeleteMessage = async (messageid: string) => {
    if (!selectedChat) return;
    try {
      const data = await apiCall('deleteMessage', { chatId: selectedChat.chatId, messageid });
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setMessages(prev => prev.filter(m => m.messageid !== messageid));
      toast.success('Mensagem apagada');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao apagar mensagem');
    }
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
