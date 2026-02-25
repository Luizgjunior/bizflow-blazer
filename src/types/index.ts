export interface Tenant {
  id: string;
  nome: string;
  plano: 'starter' | 'pro' | 'enterprise';
  limites_consulta: number;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  role: 'admin_global' | 'empresa';
  nome: string;
  email: string;
}

export interface ICP {
  id: string;
  tenant_id: string;
  nome: string;
  payload_json: Record<string, any>;
  versao: number;
  created_at: string;
}

export interface Run {
  id: string;
  tenant_id: string;
  icp_id: string;
  icp_nome?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  casadosdados_job_id: string | null;
  total_leads: number;
  requested_at: string;
  finished_at: string | null;
  error_json: Record<string, any> | null;
}

export interface Lead {
  id: string;
  tenant_id: string;
  run_id: string;
  cnpj: string;
  razao_social: string;
  uf: string;
  municipio: string;
  cnae_principal: string;
  data_abertura: string;
  situacao: string;
  score: number;
  raw_json: Record<string, any>;
  created_at: string;
  tags?: string[];
  notas?: string;
}

export interface Export {
  id: string;
  tenant_id: string;
  run_id: string;
  file_url: string;
  tipo: 'csv' | 'xlsx';
  rows_count: number;
  created_at: string;
}

export interface Automation {
  id: string;
  tenant_id: string;
  icp_id: string;
  icp_nome?: string;
  frequencia: 'diaria' | 'semanal';
  ativa: boolean;
  proxima_execucao: string;
  created_at: string;
}
