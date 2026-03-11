import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Target, Play, Users, Download, Zap, Send, MessageSquare, Kanban,
  BarChart3, Webhook, Shield, ChevronDown, ChevronRight, BookOpen, Lightbulb,
  ArrowRight, HelpCircle, Layers, Settings, Phone, FileText, UserPlus, Eye
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import useDocumentTitle from '@/hooks/useDocumentTitle';

/* ───────────── Tutorial Data ───────────── */

interface TutorialStep {
  title: string;
  description: string;
}

interface Tutorial {
  id: string;
  icon: any;
  title: string;
  category: string;
  summary: string;
  steps: TutorialStep[];
  tips?: string[];
}

const TUTORIALS: Tutorial[] = [
  {
    id: 'icps',
    icon: Target,
    title: 'Criar e Gerenciar ICPs',
    category: 'Prospecção',
    summary: 'Aprenda a definir seu Perfil de Cliente Ideal (ICP) para encontrar leads qualificados.',
    steps: [
      { title: 'Acesse a página de ICPs', description: 'No menu lateral, clique em "ICPs" para acessar a lista de perfis.' },
      { title: 'Clique em "Novo ICP"', description: 'Clique no botão para abrir o formulário de criação.' },
      { title: 'Defina o nome do ICP', description: 'Dê um nome descritivo, como "Restaurantes SP" ou "Tech Startups".' },
      { title: 'Configure os filtros', description: 'Selecione os critérios: CNAEs (atividades econômicas), UF, município, porte da empresa, natureza jurídica, capital social, situação cadastral e tempo de abertura.' },
      { title: 'Defina a quantidade de leads', description: 'Escolha quantos leads deseja buscar por execução (dentro do limite do seu plano).' },
      { title: 'Opções de contato', description: 'Marque "Somente com telefone" e/ou "Somente com email" para filtrar leads que tenham esses dados de contato.' },
      { title: 'Salve o ICP', description: 'Clique em "Salvar" para guardar o perfil. Você pode editá-lo a qualquer momento.' },
    ],
    tips: [
      'Quanto mais específico o ICP, maior a qualidade dos leads.',
      'Comece com filtros amplos e vá refinando conforme os resultados.',
      'Você pode criar quantos ICPs quiser em qualquer plano.',
    ],
  },
  {
    id: 'runs',
    icon: Play,
    title: 'Executar Buscas (Runs)',
    category: 'Prospecção',
    summary: 'Saiba como executar um ICP para prospectar leads automaticamente.',
    steps: [
      { title: 'Acesse a página de ICPs', description: 'Vá até "ICPs" no menu lateral.' },
      { title: 'Escolha o ICP desejado', description: 'Identifique o ICP que deseja executar na lista.' },
      { title: 'Clique em "Executar"', description: 'Clique no botão de execução (▶) ao lado do ICP.' },
      { title: 'Aguarde o processamento', description: 'A busca será enfileirada e processada automaticamente. Acompanhe o status em "Runs".' },
      { title: 'Visualize os resultados', description: 'Quando concluída, os leads aparecerão na página "Leads" e na run específica.' },
    ],
    tips: [
      'Cada execução consome do limite mensal de leads do seu plano.',
      'Acompanhe suas execuções em andamento na página "Runs".',
      'Se uma run falhar, verifique os filtros do ICP e tente novamente.',
    ],
  },
  {
    id: 'leads',
    icon: Users,
    title: 'Gerenciar Leads',
    category: 'Prospecção',
    summary: 'Como visualizar, filtrar e trabalhar com seus leads prospectados.',
    steps: [
      { title: 'Acesse a página de Leads', description: 'No menu lateral, clique em "Leads" para ver todos os leads prospectados.' },
      { title: 'Filtre por score', description: 'Os leads são ordenados por score (pontuação de qualidade). Leads com maior score são mais aderentes ao seu ICP.' },
      { title: 'Visualize os detalhes', description: 'Clique em um lead para ver CNPJ, razão social, CNAE, município, UF e dados adicionais.' },
      { title: 'Adicione notas e tags', description: 'Use os campos de notas e tags para organizar e classificar seus leads.' },
      { title: 'Exporte os dados', description: 'Selecione leads e exporte em CSV para usar em outras ferramentas.' },
    ],
    tips: [
      'Leads com tag "webhook" vieram via integração e não contam no seu limite.',
      'Use o score para priorizar os leads mais promissores.',
      'As notas ficam salvas e visíveis para toda a equipe do tenant.',
    ],
  },
  {
    id: 'exports',
    icon: Download,
    title: 'Exportar Leads em CSV',
    category: 'Prospecção',
    summary: 'Como exportar seus leads para planilhas e ferramentas externas.',
    steps: [
      { title: 'Acesse "Exports"', description: 'Vá até a página de Exports no menu lateral.' },
      { title: 'Selecione a run', description: 'Escolha a execução (run) cujos leads deseja exportar.' },
      { title: 'Clique em "Exportar CSV"', description: 'O sistema gerará um arquivo CSV com todos os dados dos leads.' },
      { title: 'Baixe o arquivo', description: 'Clique no link de download para salvar o CSV no seu dispositivo.' },
    ],
    tips: [
      'O CSV inclui: CNPJ, razão social, CNAE, UF, município, score e dados de contato.',
      'Importe o CSV diretamente no Google Sheets, Excel ou qualquer CRM.',
    ],
  },
  {
    id: 'automacao',
    icon: Zap,
    title: 'Configurar Automações',
    category: 'Automação',
    summary: 'Agende execuções automáticas dos seus ICPs para prospecção contínua.',
    steps: [
      { title: 'Acesse "Automação"', description: 'No menu lateral, clique em "Automação".' },
      { title: 'Crie uma automação', description: 'Clique em "Nova Automação" e selecione o ICP que deseja automatizar.' },
      { title: 'Defina a frequência', description: 'Escolha entre diária, semanal ou mensal.' },
      { title: 'Ative a automação', description: 'Ligue o toggle para ativar. O sistema executará automaticamente nos intervalos definidos.' },
      { title: 'Acompanhe os resultados', description: 'As execuções automáticas aparecerão em "Runs" e os leads em "Leads".' },
    ],
    tips: [
      'Automações respeitam o limite mensal de leads do seu plano.',
      'Você pode pausar e retomar automações a qualquer momento.',
      'Combine com webhooks para receber leads em tempo real no seu CRM.',
    ],
  },
  {
    id: 'webhooks',
    icon: Webhook,
    title: 'Configurar Webhooks',
    category: 'Integração',
    summary: 'Receba leads automaticamente no seu sistema via webhook.',
    steps: [
      { title: 'Acesse as configurações', description: 'Vá até a página de configurações do seu tenant.' },
      { title: 'Gere um token de webhook', description: 'Clique em "Gerar Token" para criar uma chave de autenticação.' },
      { title: 'Copie a URL do webhook', description: 'Use a URL fornecida para configurar no n8n, Make, Zapier ou seu sistema.' },
      { title: 'Configure a integração', description: 'No seu sistema destino, cole a URL e o token de autenticação.' },
      { title: 'Teste a conexão', description: 'Execute um ICP e verifique se os dados chegam no seu sistema.' },
    ],
    tips: [
      'Leads recebidos via webhook universal não contam no seu limite.',
      'Cada token pode ser ativado/desativado individualmente.',
      'Disponível nos planos Enterprise.',
    ],
  },
  {
    id: 'whatsapp-instance',
    icon: Phone,
    title: 'Conectar o WhatsApp',
    category: 'WhatsApp',
    summary: 'Como conectar seu número de WhatsApp para usar disparos e chat.',
    steps: [
      { title: 'Acesse "Disparos"', description: 'No menu lateral, clique em "Disparos".' },
      { title: 'Conecte sua instância', description: 'Se não houver uma instância conectada, clique em "Conectar WhatsApp".' },
      { title: 'Escaneie o QR Code', description: 'Um QR Code será exibido. Abra o WhatsApp no celular > Dispositivos conectados > Conectar dispositivo > Escaneie o código.' },
      { title: 'Aguarde a conexão', description: 'O status mudará para "Conectado" quando o vínculo for estabelecido.' },
      { title: 'Pronto!', description: 'Agora você pode usar os disparos em massa e o chat em tempo real.' },
    ],
    tips: [
      'Mantenha o celular conectado à internet para o WhatsApp funcionar.',
      'Você pode desconectar e reconectar a qualquer momento.',
      'Disponível nos planos Premium e Enterprise.',
    ],
  },
  {
    id: 'disparos',
    icon: Send,
    title: 'Criar Campanhas de Disparo',
    category: 'WhatsApp',
    summary: 'Envie mensagens em massa para seus leads pelo WhatsApp.',
    steps: [
      { title: 'Acesse "Disparos"', description: 'No menu lateral, clique em "Disparos".' },
      { title: 'Crie uma campanha', description: 'Clique em "Nova Campanha" e defina um nome.' },
      { title: 'Escolha o tipo', description: 'Selecione entre texto simples, mídia (imagem/vídeo) ou template.' },
      { title: 'Escreva a mensagem', description: 'Redija o conteúdo da mensagem. Para mídia, faça upload do arquivo.' },
      { title: 'Selecione os contatos', description: 'Escolha leads do sistema ou importe via CSV (telefone, nome, CNPJ).' },
      { title: 'Inicie o disparo', description: 'Revise e clique em "Iniciar". O sistema enviará com delays aleatórios para evitar bloqueios.' },
      { title: 'Acompanhe o progresso', description: 'Veja em tempo real: enviados, falhas e status de cada contato.' },
    ],
    tips: [
      'O sistema aplica delays de 1-3 segundos entre mensagens para proteção.',
      'Use mensagens personalizadas e relevantes para evitar denúncias.',
      'Evite enviar para muitos contatos de uma só vez no início — vá aumentando gradualmente.',
      'Disponível nos planos Premium e Enterprise.',
    ],
  },
  {
    id: 'whatsapp-chat',
    icon: MessageSquare,
    title: 'Chat WhatsApp em Tempo Real',
    category: 'WhatsApp',
    summary: 'Converse com seus leads diretamente pela plataforma.',
    steps: [
      { title: 'Acesse "Chat WhatsApp"', description: 'No menu lateral, clique em "Chat WhatsApp".' },
      { title: 'Veja suas conversas', description: 'A lista mostra todas as conversas ativas do seu WhatsApp conectado.' },
      { title: 'Selecione uma conversa', description: 'Clique em um contato para abrir o histórico de mensagens.' },
      { title: 'Envie mensagens', description: 'Digite no campo de texto e envie. Você também pode enviar mídia (imagens, documentos) clicando no ícone de anexo.' },
      { title: 'Marque como lido', description: 'As mensagens são marcadas como lidas automaticamente ao abrir a conversa.' },
    ],
    tips: [
      'O chat atualiza automaticamente a cada poucos segundos.',
      'Novos contatos que enviam mensagem criam automaticamente um card no CRM.',
      'A interface é otimizada para uso no celular.',
    ],
  },
  {
    id: 'crm-kanban',
    icon: Kanban,
    title: 'Usar o CRM Kanban',
    category: 'CRM',
    summary: 'Gerencie seus negócios no pipeline visual estilo Kanban.',
    steps: [
      { title: 'Acesse "CRM Kanban"', description: 'No menu lateral, clique em "CRM Kanban".' },
      { title: 'Visualize o pipeline', description: 'As colunas representam as etapas do funil: Novo, Contato, Proposta, Negociação, Fechado.' },
      { title: 'Crie um deal', description: 'Clique em "+" em qualquer coluna para criar um novo negócio manualmente.' },
      { title: 'Arraste entre etapas', description: 'Use drag & drop para mover deals entre as etapas do funil.' },
      { title: 'Edite os detalhes', description: 'Clique em um deal para editar: título, valor, contato, telefone, CNPJ e notas.' },
      { title: 'Marque como ganho/perdido', description: 'Use os botões para registrar o resultado final de cada negociação.' },
    ],
    tips: [
      'Deals vindos do WhatsApp são criados automaticamente na etapa "Novo".',
      'Personalize as etapas e cores do pipeline conforme seu processo de vendas.',
      'Acompanhe métricas de conversão no CRM Dashboard.',
    ],
  },
  {
    id: 'crm-dashboard',
    icon: BarChart3,
    title: 'CRM Dashboard e Métricas',
    category: 'CRM',
    summary: 'Acompanhe o desempenho das suas vendas com gráficos e indicadores.',
    steps: [
      { title: 'Acesse "CRM Dashboard"', description: 'No menu lateral, clique em "CRM Dashboard".' },
      { title: 'Veja os indicadores', description: 'Total de deals, valor do pipeline, taxa de conversão e deals ganhos/perdidos.' },
      { title: 'Analise o funil', description: 'O gráfico de funil mostra quantos deals estão em cada etapa.' },
      { title: 'Atividades recentes', description: 'Acompanhe o histórico de movimentações e atividades dos deals.' },
    ],
    tips: [
      'Use o dashboard para identificar gargalos no seu funil de vendas.',
      'A taxa de conversão é calculada automaticamente com base nos deals fechados.',
    ],
  },
  {
    id: 'primeiro-acesso',
    icon: UserPlus,
    title: 'Primeiro Acesso / Magic Link',
    category: 'Conta',
    summary: 'Como fazer login pela primeira vez usando o link mágico recebido por email.',
    steps: [
      { title: 'Verifique seu email', description: 'Após a compra, você receberá um email com um link de acesso.' },
      { title: 'Clique no link', description: 'O link mágico te autentica automaticamente sem necessidade de senha.' },
      { title: 'Acesse o sistema', description: 'Você será redirecionado diretamente para o dashboard do LeadFlow.' },
      { title: 'Para próximos acessos', description: 'Use a opção "Magic Link" na tela de login. Informe seu email e receba um novo link de acesso.' },
    ],
    tips: [
      'O link mágico expira após alguns minutos por segurança.',
      'Verifique a pasta de spam se não encontrar o email.',
      'Você pode definir uma senha fixa acessando a opção "Primeiro Acesso" na tela de login.',
    ],
  },
];

const CATEGORIES = ['Todos', 'Prospecção', 'Automação', 'WhatsApp', 'CRM', 'Integração', 'Conta'];

/* ───────────── Component ───────────── */

export default function AjudaPage() {
  useDocumentTitle('Ajuda');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(null);

  const filteredTutorials = TUTORIALS.filter((t) => {
    const matchesCategory = selectedCategory === 'Todos' || t.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.steps.some(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <PageHeader title="Central de Ajuda" subtitle="Tutoriais e guias de uso do sistema" />

      {/* Search + Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tutoriais..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { icon: BookOpen, label: 'Tutoriais', value: TUTORIALS.length },
          { icon: Target, label: 'Prospecção', value: TUTORIALS.filter(t => t.category === 'Prospecção').length },
          { icon: MessageSquare, label: 'WhatsApp', value: TUTORIALS.filter(t => t.category === 'WhatsApp').length },
          { icon: Kanban, label: 'CRM', value: TUTORIALS.filter(t => t.category === 'CRM').length },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-xl border border-border bg-card p-3 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tutorials List */}
      <div className="space-y-3">
        {filteredTutorials.length === 0 && (
          <div className="text-center py-12">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum tutorial encontrado para "{searchQuery}"</p>
          </div>
        )}

        {filteredTutorials.map((tutorial) => {
          const Icon = tutorial.icon;
          const isExpanded = expandedTutorial === tutorial.id;

          return (
            <motion.div
              key={tutorial.id}
              layout
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedTutorial(isExpanded ? null : tutorial.id)}
                className="w-full flex items-start gap-4 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm">{tutorial.title}</h3>
                    <Badge variant="outline" className="text-[9px] shrink-0">{tutorial.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tutorial.summary}</p>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-5 border-t border-border pt-4">
                      {/* Steps */}
                      <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Passo a Passo
                      </h4>
                      <div className="space-y-3 mb-5">
                        {tutorial.steps.map((step, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                              <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{step.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tips */}
                      {tutorial.tips && tutorial.tips.length > 0 && (
                        <div className="rounded-lg bg-muted/50 border border-border p-4">
                          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                            Dicas
                          </h4>
                          <ul className="space-y-1.5">
                            {tutorial.tips.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </AppLayout>
  );
}
