import type { ICP, Run, Lead, Export, Automation, Tenant } from '@/types';

export const mockTenant: Tenant = {
  id: 't1',
  nome: 'TechCorp Brasil',
  plano: 'pro',
  limites_consulta: 5000,
  created_at: '2024-01-15',
};

export const mockICPs: ICP[] = [
  {
    id: 'icp1',
    tenant_id: 't1',
    nome: 'SaaS B2B - SP Capital',
    payload_json: { cnaes: ['6201-5/01'], uf: 'SP', municipio: 'São Paulo', porte: 'ME', tempo_abertura_min: 2 },
    versao: 3,
    created_at: '2024-11-10',
  },
  {
    id: 'icp2',
    tenant_id: 't1',
    nome: 'E-commerce - Sul',
    payload_json: { cnaes: ['4751-2/01'], uf: ['PR', 'SC', 'RS'], porte: 'EPP' },
    versao: 1,
    created_at: '2024-12-01',
  },
  {
    id: 'icp3',
    tenant_id: 't1',
    nome: 'Construtoras - RJ',
    payload_json: { cnaes: ['4120-4/00'], uf: 'RJ', porte: 'Demais' },
    versao: 2,
    created_at: '2025-01-05',
  },
];

export const mockRuns: Run[] = [
  { id: 'r1', tenant_id: 't1', icp_id: 'icp1', icp_nome: 'SaaS B2B - SP Capital', status: 'done', casadosdados_job_id: 'cdj-001', total_leads: 342, requested_at: '2025-02-20T10:30:00', finished_at: '2025-02-20T10:45:00', error_json: null },
  { id: 'r2', tenant_id: 't1', icp_id: 'icp2', icp_nome: 'E-commerce - Sul', status: 'running', casadosdados_job_id: 'cdj-002', total_leads: 0, requested_at: '2025-02-25T08:00:00', finished_at: null, error_json: null },
  { id: 'r3', tenant_id: 't1', icp_id: 'icp1', icp_nome: 'SaaS B2B - SP Capital', status: 'queued', casadosdados_job_id: null, total_leads: 0, requested_at: '2025-02-25T09:15:00', finished_at: null, error_json: null },
  { id: 'r4', tenant_id: 't1', icp_id: 'icp3', icp_nome: 'Construtoras - RJ', status: 'error', casadosdados_job_id: 'cdj-003', total_leads: 0, requested_at: '2025-02-19T14:00:00', finished_at: '2025-02-19T14:02:00', error_json: { message: 'Rate limit exceeded' } },
  { id: 'r5', tenant_id: 't1', icp_id: 'icp2', icp_nome: 'E-commerce - Sul', status: 'done', casadosdados_job_id: 'cdj-004', total_leads: 189, requested_at: '2025-02-18T11:00:00', finished_at: '2025-02-18T11:20:00', error_json: null },
];

export const mockLeads: Lead[] = Array.from({ length: 25 }, (_, i) => ({
  id: `l${i + 1}`,
  tenant_id: 't1',
  run_id: i < 15 ? 'r1' : 'r5',
  cnpj: `${String(10 + i).padStart(2, '0')}.${String(100 + i * 3)}.${String(200 + i * 7)}/0001-${String(10 + i)}`,
  razao_social: [
    'TechSoft Sistemas Ltda', 'Digital Commerce SA', 'CloudPay Tecnologia', 'DataHub Analytics',
    'Inova Solutions ME', 'SmartRetail Ltda', 'LogiTech Express', 'FinControl Digital',
    'AgriSmart Tech', 'EduTech Brasil', 'HealthConnect SA', 'GreenEnergy Soluções',
    'AutoParts Digital', 'FoodDelivery Tech', 'SecurityPro Sistemas', 'BioTech Lab',
    'MarketPlace Hub', 'TravelTech SA', 'PetCare Digital', 'BuildSmart Eng',
    'SportFit Tech', 'ArtMedia Digital', 'LegalTech Pro', 'TransLog Systems', 'CyberDef Tech'
  ][i],
  uf: ['SP', 'RJ', 'PR', 'SC', 'RS', 'MG', 'BA', 'PE'][i % 8],
  municipio: ['São Paulo', 'Rio de Janeiro', 'Curitiba', 'Florianópolis', 'Porto Alegre', 'Belo Horizonte', 'Salvador', 'Recife'][i % 8],
  cnae_principal: ['6201-5/01', '4751-2/01', '6202-3/00', '6311-9/00'][i % 4],
  data_abertura: `20${String(15 + (i % 10))}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
  situacao: i % 7 === 0 ? 'Baixada' : 'Ativa',
  score: Math.max(20, Math.min(100, 95 - i * 3 + (i % 5) * 8)),
  raw_json: {},
  created_at: '2025-02-20',
  tags: i % 3 === 0 ? ['quente'] : i % 3 === 1 ? ['médio'] : [],
  notas: i % 4 === 0 ? 'Contato inicial feito' : '',
}));

export const mockExports: Export[] = [
  { id: 'e1', tenant_id: 't1', run_id: 'r1', file_url: '#', tipo: 'csv', rows_count: 342, created_at: '2025-02-20T11:00:00' },
  { id: 'e2', tenant_id: 't1', run_id: 'r5', file_url: '#', tipo: 'xlsx', rows_count: 189, created_at: '2025-02-18T12:00:00' },
  { id: 'e3', tenant_id: 't1', run_id: 'r1', file_url: '#', tipo: 'xlsx', rows_count: 342, created_at: '2025-02-21T09:00:00' },
];

export const mockAutomations: Automation[] = [
  { id: 'a1', tenant_id: 't1', icp_id: 'icp1', icp_nome: 'SaaS B2B - SP Capital', frequencia: 'diaria', ativa: true, proxima_execucao: '2025-02-26T10:00:00', created_at: '2025-02-01' },
  { id: 'a2', tenant_id: 't1', icp_id: 'icp2', icp_nome: 'E-commerce - Sul', frequencia: 'semanal', ativa: false, proxima_execucao: '2025-03-03T08:00:00', created_at: '2025-02-10' },
];

export const dashboardStats = {
  totalLeads: 531,
  leadsHoje: 42,
  runsAtivas: 1,
  icpsAtivos: 3,
  taxaQualificacao: 78,
  limitesUsados: 1240,
  limitesTotal: 5000,
};
