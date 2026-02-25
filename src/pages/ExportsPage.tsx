import { Download, FileText, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockExports } from '@/data/mock';

export default function ExportsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Exports"
        description="Histórico de arquivos exportados"
      />

      <div className="space-y-3">
        {mockExports.map((exp, i) => (
          <motion.div
            key={exp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-muted">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Run #{exp.run_id} — {exp.rows_count} registros
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(exp.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">{exp.tipo}</Badge>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Baixar
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
