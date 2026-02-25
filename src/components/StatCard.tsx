import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: 'default' | 'primary' | 'accent' | 'warning';
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/5 border-primary/20',
  accent: 'bg-accent/5 border-accent/20',
  warning: 'bg-warning/5 border-warning/20',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-warning/10 text-warning',
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-4 lg:p-5 transition-all', variantStyles[variant])}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-destructive')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', iconVariantStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
