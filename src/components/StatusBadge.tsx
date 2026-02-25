import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'queued' | 'running' | 'done' | 'error' | 'ativa' | 'inativa';
  size?: 'sm' | 'md';
}

const statusConfig = {
  queued: { label: 'Na fila', dotClass: 'status-dot-queued', bgClass: 'bg-muted text-muted-foreground' },
  running: { label: 'Executando', dotClass: 'status-dot-warning', bgClass: 'bg-warning/10 text-warning' },
  done: { label: 'Concluído', dotClass: 'status-dot-success', bgClass: 'bg-success/10 text-success' },
  error: { label: 'Erro', dotClass: 'status-dot-error', bgClass: 'bg-destructive/10 text-destructive' },
  ativa: { label: 'Ativa', dotClass: 'status-dot-success', bgClass: 'bg-success/10 text-success' },
  inativa: { label: 'Inativa', dotClass: 'status-dot-queued', bgClass: 'bg-muted text-muted-foreground' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgClass,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      )}
    >
      <span className={config.dotClass} />
      {config.label}
    </span>
  );
}
