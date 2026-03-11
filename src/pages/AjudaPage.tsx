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
    summary: 'Defina o perfil exato do cliente que você quer prospectar. O ICP é a base de toda busca automatizada — quanto melhor configurado, melhores serão os leads encontrados.',
    steps: [
      { title: 'Acesse a página de ICPs', description: 'No menu lateral, clique em "ICPs". Aqui ficam todos os perfis de busca que você já criou.' },
      { title: 'Clique em "Novo ICP"', description: 'O botão abre o formulário completo de criação do perfil de cliente ideal.' },
      { title: 'Dê um nome descritivo', description: 'Escolha um nome que identifique rapidamente o público-alvo, como "Restaurantes SP Centro" ou "E-commerces Moda Feminina".' },
      { title: 'Configure os filtros de busca', description: 'Defina os critérios: CNAEs (atividade econômica), UF, município, porte (MEI, ME, EPP, etc.), natureza jurídica, faixa de capital social, situação cadastral e tempo de abertura da empresa.' },
      { title: 'Defina a quantidade de leads', description: 'Escolha quantos leads deseja buscar por execução. O limite varia conforme o plano contratado (Pro: 6.000/mês, Premium: 14.000/mês, Enterprise: 32.000/mês).' },
      { title: 'Filtre por dados de contato', description: 'Marque "Somente com telefone" e/ou "Somente com email" para garantir que os leads retornados possuam esses dados — essencial para campanhas de WhatsApp.' },
      { title: 'Salve e edite quando quiser', description: 'Clique em "Salvar". O ICP fica disponível para execuções imediatas ou agendadas. Você pode editá-lo ou duplicá-lo a qualquer momento.' },
    ],
    tips: [
      'Quanto mais específico o ICP, menor o volume mas maior a qualidade dos leads.',
      'Comece com filtros amplos e vá refinando conforme analisa os resultados.',
      'Você pode criar quantos ICPs quiser — não há limite de perfis em nenhum plano.',
      'Use ICPs diferentes para testar segmentos de mercado antes de investir em campanhas.',
    ],
  },
  {
    id: 'runs',
    icon: Play,
    title: 'Executar Buscas (Runs)',
    category: 'Prospecção',
    summary: 'Cada "Run" é uma execução do seu ICP que vai buscar leads reais de empresas ativas no Brasil. O processamento é automático e você acompanha o status em tempo real.',
    steps: [
      { title: 'Acesse a página de ICPs ou Runs', description: 'Você pode iniciar uma busca diretamente pela página de ICPs (clicando no botão ▶ ao lado do perfil) ou pela página de Runs.' },
      { title: 'Escolha o ICP e clique em "Executar"', description: 'Selecione o perfil de cliente ideal desejado. A busca será enviada para processamento imediatamente.' },
      { title: 'Acompanhe o progresso', description: 'Na página "Runs", você verá o status atualizado: pendente → processando → concluída (ou falha). O tempo médio depende do volume solicitado.' },
      { title: 'Visualize os leads encontrados', description: 'Ao concluir, os leads ficam disponíveis na página "Leads" com score de qualidade, CNPJ, razão social, CNAE, localização e dados de contato.' },
      { title: 'Reprocesse se necessário', description: 'Se uma run falhar (erro de filtro ou timeout), ajuste o ICP e execute novamente. Runs com falha não consomem seu limite.' },
    ],
    tips: [
      'Cada execução consome leads do seu limite mensal. Monitore seu consumo no Dashboard de Prospecção.',
      'Runs com muitos filtros combinados podem retornar menos resultados — ajuste gradualmente.',
      'Você pode executar múltiplos ICPs simultaneamente, cada um vira uma Run independente.',
    ],
  },
  {
    id: 'leads',
    icon: Users,
    title: 'Gerenciar Leads',
    category: 'Prospecção',
    summary: 'Todos os leads prospectados ficam centralizados aqui. Filtre por score, adicione notas, aplique tags e exporte para trabalhar em outros canais.',
    steps: [
      { title: 'Acesse a página de Leads', description: 'No menu lateral, clique em "Leads". A lista mostra todos os leads encontrados em todas as suas Runs, ordenados por data ou score.' },
      { title: 'Entenda o score de qualidade', description: 'O score (0-100) indica o quanto o lead é aderente ao seu ICP. Leads com score alto têm maior probabilidade de se tornarem clientes.' },
      { title: 'Explore os detalhes do lead', description: 'Clique em qualquer lead para ver informações completas: CNPJ, razão social, CNAE principal, data de abertura, município, UF, situação cadastral e dados de contato.' },
      { title: 'Organize com notas e tags', description: 'Adicione notas internas (ex: "Ligado em 10/03, retornar sexta") e tags coloridas (ex: "Quente", "Retornar", "Sem interesse") para organizar seu fluxo de trabalho.' },
      { title: 'Exporte para planilhas', description: 'Selecione os leads desejados e exporte em CSV para importar no Google Sheets, Excel ou qualquer ferramenta externa.' },
    ],
    tips: [
      'Use o score para priorizar contatos — foque nos leads acima de 70 primeiro.',
      'As notas e tags ficam visíveis para todos os usuários do mesmo tenant (equipe).',
      'Combine filtros de UF, CNAE e score para encontrar rapidamente os melhores leads.',
    ],
  },
  {
    id: 'exports',
    icon: Download,
    title: 'Exportar Leads em CSV',
    category: 'Prospecção',
    summary: 'Exporte seus leads prospectados para arquivos CSV e use em planilhas, CRMs externos ou ferramentas de automação de marketing.',
    steps: [
      { title: 'Acesse "Exports"', description: 'No menu lateral, clique em "Exports". Aqui ficam todos os arquivos já exportados e a opção de gerar novos.' },
      { title: 'Selecione a Run desejada', description: 'Escolha a execução cujos leads deseja exportar. Cada Run gera um conjunto independente de leads.' },
      { title: 'Clique em "Exportar CSV"', description: 'O sistema processa o arquivo com todos os dados dos leads: CNPJ, razão social, CNAE, UF, município, score, telefone e email.' },
      { title: 'Baixe o arquivo', description: 'Quando pronto, clique no link de download. O arquivo fica disponível para download por 7 dias.' },
    ],
    tips: [
      'O CSV exportado é compatível com Google Sheets, Excel, Pipedrive, HubSpot e qualquer CRM que aceite importação CSV.',
      'Exporte periodicamente para manter seus sistemas externos atualizados.',
      'Combine com automações para ter um fluxo contínuo de novos leads exportados.',
    ],
  },
  {
    id: 'automacao',
    icon: Zap,
    title: 'Configurar Automações',
    category: 'Automação',
    summary: 'Agende execuções automáticas dos seus ICPs para que o sistema busque novos leads continuamente, sem precisar executar manualmente.',
    steps: [
      { title: 'Acesse "Automação"', description: 'No menu lateral, clique em "Automação". Aqui você cria e gerencia todas as suas automações de prospecção.' },
      { title: 'Crie uma nova automação', description: 'Clique em "Nova Automação". Selecione o ICP que deseja automatizar — ele será executado nos intervalos que você definir.' },
      { title: 'Escolha a frequência', description: 'Defina o intervalo de execução: diária (para prospecção intensiva), semanal (para fluxo constante) ou mensal (para volume moderado).' },
      { title: 'Ative a automação', description: 'Ligue o toggle para ativar. O sistema calculará a próxima execução e mostrará a data/hora programada.' },
      { title: 'Monitore os resultados', description: 'Cada execução automática aparece em "Runs" e os leads vão direto para "Leads". Você recebe os dados sem levantar um dedo.' },
    ],
    tips: [
      'Automações consomem do seu limite mensal de leads — planeje a frequência de acordo com seu plano.',
      'Você pode pausar e retomar automações a qualquer momento sem perder a configuração.',
      'Combine automações com diferentes ICPs para diversificar sua base de leads.',
      'Revise periodicamente seus ICPs automatizados para garantir que continuam relevantes.',
    ],
  },
  {
    id: 'whatsapp-instance',
    icon: Phone,
    title: 'Conectar o WhatsApp',
    category: 'WhatsApp',
    summary: 'Vincule seu número de WhatsApp à plataforma para habilitar disparos em massa e o chat em tempo real. O processo leva menos de 1 minuto.',
    steps: [
      { title: 'Acesse "Disparos"', description: 'No menu lateral, clique em "Disparos". Se nenhum WhatsApp estiver conectado, o sistema exibirá a opção de conexão.' },
      { title: 'Clique em "Conectar WhatsApp"', description: 'O botão inicia o processo de vinculação do seu número. Um QR Code será gerado na tela.' },
      { title: 'Escaneie o QR Code', description: 'No celular, abra o WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo → Aponte a câmera para o QR Code na tela.' },
      { title: 'Aguarde a confirmação', description: 'Em poucos segundos o status mudará para "Conectado" e seu número aparecerá na interface. A partir daqui você já pode enviar mensagens.' },
    ],
    tips: [
      'Mantenha o celular com internet ativa para que o WhatsApp Web funcione corretamente.',
      'Caso a conexão caia, basta reconectar escaneando um novo QR Code.',
      'Recomendamos usar um número comercial separado para proteger seu número pessoal.',
      'Funcionalidade disponível nos planos Premium e Enterprise.',
    ],
  },
  {
    id: 'disparos',
    icon: Send,
    title: 'Criar Campanhas de Disparo',
    category: 'WhatsApp',
    summary: 'Envie mensagens personalizadas em massa para seus leads via WhatsApp. O sistema aplica delays inteligentes para proteger seu número contra bloqueios.',
    steps: [
      { title: 'Acesse "Disparos"', description: 'No menu lateral, clique em "Disparos". Certifique-se de que seu WhatsApp está conectado antes de criar campanhas.' },
      { title: 'Crie uma nova campanha', description: 'Clique em "Nova Campanha", defina um nome identificável (ex: "Promoção Março - Restaurantes SP").' },
      { title: 'Escolha o tipo de mensagem', description: 'Selecione: texto simples (mensagem escrita), mídia (imagem, vídeo ou documento anexo) ou template (modelo pré-aprovado).' },
      { title: 'Redija o conteúdo', description: 'Escreva sua mensagem. Para mídia, faça upload do arquivo. Dica: mensagens curtas e diretas têm melhor taxa de resposta.' },
      { title: 'Selecione os destinatários', description: 'Escolha leads já prospectados no sistema ou importe uma lista CSV com colunas: telefone, nome e CNPJ.' },
      { title: 'Revise e inicie o disparo', description: 'Confira o resumo (total de contatos, tipo de mensagem) e clique em "Iniciar". O envio começa imediatamente.' },
      { title: 'Acompanhe em tempo real', description: 'O painel mostra o progresso: enviados com sucesso, falhas, e o status individual de cada contato.' },
    ],
    tips: [
      'O sistema insere delays aleatórios de 1 a 3 segundos entre cada envio para simular comportamento humano.',
      'Comece com grupos pequenos (50-100 contatos) e aumente gradualmente para aquecer o número.',
      'Evite mensagens genéricas de spam — personalize e agregue valor para reduzir denúncias.',
      'Horários comerciais (9h-18h) têm melhores taxas de abertura e resposta.',
      'Funcionalidade disponível nos planos Premium e Enterprise.',
    ],
  },
  {
    id: 'whatsapp-chat',
    icon: MessageSquare,
    title: 'Chat WhatsApp em Tempo Real',
    category: 'WhatsApp',
    summary: 'Responda mensagens dos seus leads diretamente pela plataforma, sem precisar alternar entre o WhatsApp e o sistema. Todas as conversas ficam centralizadas.',
    steps: [
      { title: 'Acesse "Chat WhatsApp"', description: 'No menu lateral, clique em "Chat WhatsApp". A interface exibe todas as conversas do seu WhatsApp conectado.' },
      { title: 'Navegue pelas conversas', description: 'A lista lateral mostra os contatos com as últimas mensagens. Conversas não lidas ficam destacadas no topo.' },
      { title: 'Abra uma conversa', description: 'Clique em um contato para visualizar o histórico completo de mensagens trocadas.' },
      { title: 'Envie mensagens e mídias', description: 'Digite no campo de texto e envie. Use o ícone de anexo (📎) para enviar imagens, documentos PDF ou áudios.' },
      { title: 'Acompanhe em tempo real', description: 'As mensagens recebidas aparecem automaticamente na tela, sem necessidade de atualizar a página.' },
    ],
    tips: [
      'Quando um novo contato envia mensagem, um card é criado automaticamente no CRM Kanban na etapa "Novo".',
      'Use o chat para qualificar leads antes de movê-los no pipeline do CRM.',
      'A interface é responsiva e funciona bem no celular para atendimento em movimento.',
      'O histórico completo de mensagens fica salvo e acessível para toda a equipe.',
    ],
  },
  {
    id: 'crm-kanban',
    icon: Kanban,
    title: 'Usar o CRM Kanban',
    category: 'CRM',
    summary: 'Gerencie todo o seu funil de vendas visualmente. Arraste cards entre etapas, registre valores e acompanhe cada negociação do primeiro contato ao fechamento.',
    steps: [
      { title: 'Acesse "CRM Kanban"', description: 'No menu lateral, clique em "CRM Kanban". O board exibe seu pipeline completo com todas as etapas configuradas.' },
      { title: 'Entenda as colunas do pipeline', description: 'Cada coluna representa uma etapa do funil de vendas (ex: Novo → Contato → Proposta → Negociação → Fechado). Os cards se movem da esquerda para a direita conforme avançam.' },
      { title: 'Crie um deal manualmente', description: 'Clique no "+" em qualquer coluna para adicionar um negócio. Preencha: título, valor estimado, nome do contato, telefone e CNPJ.' },
      { title: 'Mova deals entre etapas', description: 'Arraste e solte (drag & drop) os cards entre colunas para atualizar o estágio da negociação. A movimentação é registrada no histórico de atividades.' },
      { title: 'Edite detalhes do deal', description: 'Clique em qualquer card para abrir os detalhes. Atualize valor, notas, contato e acompanhe todo o histórico de movimentações.' },
      { title: 'Finalize negociações', description: 'Use os botões "Ganho" ✅ ou "Perdido" ❌ para registrar o resultado. Deals finalizados saem do pipeline e entram nas métricas do CRM Dashboard.' },
    ],
    tips: [
      'Leads que enviam mensagem no WhatsApp criam cards automaticamente na coluna "Novo".',
      'Personalize as etapas e cores do pipeline de acordo com seu processo de vendas.',
      'Mantenha os valores atualizados para ter previsões de receita precisas no Dashboard.',
      'Use as notas do deal para registrar pontos importantes de cada conversa com o cliente.',
    ],
  },
  {
    id: 'crm-dashboard',
    icon: BarChart3,
    title: 'CRM Dashboard e Métricas',
    category: 'CRM',
    summary: 'Visualize o desempenho completo das suas vendas com indicadores-chave, gráfico de funil, previsão de receita ponderada e timeline de atividades.',
    steps: [
      { title: 'Acesse "CRM Dashboard"', description: 'No menu lateral, clique em "CRM Dashboard". É a primeira opção do menu — sua visão geral de vendas.' },
      { title: 'Analise os indicadores principais', description: 'No topo, veja os KPIs: total de deals ativos, valor total do pipeline, taxa de conversão (ganhos/total) e receita fechada no período.' },
      { title: 'Estude o gráfico de funil', description: 'O funil visual mostra quantos deals estão em cada etapa e identifica onde estão os gargalos — etapas com muita acumulação indicam pontos de melhoria.' },
      { title: 'Consulte a previsão de receita', description: 'A previsão ponderada calcula a receita esperada multiplicando o valor de cada deal pela probabilidade de fechamento baseada no estágio.' },
      { title: 'Acompanhe atividades recentes', description: 'A timeline mostra as últimas movimentações: deals criados, movidos entre etapas, ganhos e perdidos — ideal para reuniões de pipeline.' },
    ],
    tips: [
      'Revise o Dashboard diariamente para identificar deals parados há muito tempo em uma etapa.',
      'A taxa de conversão entre etapas ajuda a entender onde os deals estão travando.',
      'Use os dados para definir metas realistas baseadas no histórico de performance.',
      'Compare períodos diferentes para identificar tendências de crescimento ou queda.',
    ],
  },
  {
    id: 'primeiro-acesso',
    icon: UserPlus,
    title: 'Primeiro Acesso e Login',
    category: 'Conta',
    summary: 'Entenda como funciona o acesso ao sistema. Após a compra, sua conta é criada automaticamente. Use a opção "Primeiro Acesso" na tela de login para definir sua senha.',
    steps: [
      { title: 'Sua conta é criada automaticamente', description: 'Assim que o pagamento é confirmado, o sistema cria automaticamente sua conta com o email usado na compra.' },
      { title: 'Acesse a tela de login', description: 'Na tela de login, clique em "Primeiro acesso? Definir senha" e informe o email que usou na compra.' },
      { title: 'Defina sua senha', description: 'Você receberá um email com um link para definir sua senha. Clique no link e crie uma senha segura.' },
      { title: 'Pronto para usar', description: 'Após definir a senha, faça login normalmente com seu email e senha.' },
    ],
    tips: [
      'O link para definir senha expira após alguns minutos por segurança — solicite um novo se necessário.',
      'Verifique a pasta de spam/lixo eletrônico se não encontrar o email.',
      'Seus dados e configurações são preservados entre sessões — não precisa refazer nada ao entrar novamente.',
    ],
  },
];

const CATEGORIES = ['Todos', 'Prospecção', 'Automação', 'WhatsApp', 'CRM', 'Conta'];

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
      <PageHeader title="Central de Ajuda" description="Tutoriais e guias de uso do sistema" />

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
                            <Lightbulb className="w-3.5 h-3.5 text-accent" />
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
