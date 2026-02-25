import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 80) return 'bg-success/10 text-success border-success/20';
    if (score >= 60) return 'bg-primary/10 text-primary border-primary/20';
    if (score >= 40) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <span className={cn('inline-flex items-center justify-center w-10 h-6 rounded-md text-xs font-bold border', getColor())}>
      {score}
    </span>
  );
}
