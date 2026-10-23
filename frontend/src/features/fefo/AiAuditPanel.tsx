import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { fetchAiStatus, runAiAudit } from '../../api/endpoints';
import type { AiAuditReportDto } from '../../api/types';
import { Button } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';

const PROVIDER_LABEL: Record<string, string> = { gemini: 'Google Gemini', nvidia: 'NVIDIA', none: 'no model' };

function ReportView({ report }: { report: AiAuditReportDto }) {
  const priorities = report.top3Priorities ?? [];
  const urgent = report.urgentBatches ?? [];
  const warnings = report.qualityWarnings ?? [];
  const risks = report.supplyChainRisks ?? [];
  return (
    <div className={coreStyles.pageStack} data-testid="ai-audit-report">
      {report.summary ? <p data-testid="ai-audit-summary">{report.summary}</p> : null}

      {priorities.length > 0 ? (
        <div>
          <h3 className={coreStyles.sectionTitle}>Dispatch next</h3>
          <ol className={coreStyles.timelineList}>
            {priorities.map((p) => (
              <li key={p.batchCode} className={coreStyles.timelineItem}>
                <div className={coreStyles.timelineHeader}>
                  <span>
                    <strong>{p.rank}. </strong>
                    <span className={coreStyles.monoCode}>{p.batchCode}</span> · {p.productName}
                  </span>
                </div>
                <p>
                  {p.action} {p.reasoning}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {urgent.length > 0 ? (
        <div>
          <h3 className={coreStyles.sectionTitle}>Urgent</h3>
          <ul className={coreStyles.timelineList}>
            {urgent.map((u) => (
              <li key={u.batchCode} className={coreStyles.timelineItem}>
                <span className={coreStyles.monoCode}>{u.batchCode}</span>: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div>
          <h3 className={coreStyles.sectionTitle}>Quality warnings</h3>
          <ul className={coreStyles.timelineList}>
            {warnings.map((w) => (
              <li key={w.batchCode} className={coreStyles.timelineItem}>
                <span className={coreStyles.monoCode}>{w.batchCode}</span>: {w.concern}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {risks.length > 0 ? (
        <div>
          <h3 className={coreStyles.sectionTitle}>Supply chain risks</h3>
          <ul className={coreStyles.timelineList}>
            {risks.map((r) => (
              <li key={r.risk} className={coreStyles.timelineItem}>
                <strong>{r.severity}</strong>: {r.risk} {r.recommendation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className={coreStyles.metaLabel} data-testid="ai-audit-meta">
        {report.totalAnalyzed ?? 0} batches analysed by {PROVIDER_LABEL[report.provider ?? ''] ?? report.provider} at{' '}
        {formatTimestamp(report.generatedAt)}
        {report.fromCache ? ' (saved result)' : ''}. AI suggestions can be wrong: check them against the queue
        before dispatching.
      </p>
    </div>
  );
}

/**
 * AI dispatch audit (Phase 11, S-01). Hidden unless the server has an AI provider key configured.
 * The model's advice never dispatches anything; the FEFO rules on this page still decide.
 */
export function AiAuditPanel() {
  const statusQuery = useQuery({ queryKey: ['ai', 'status'], queryFn: fetchAiStatus });
  const audit = useMutation({ mutationFn: (refresh: boolean) => runAiAudit(refresh) });

  if (!statusQuery.data?.enabled) return null;

  return (
    <section className={coreStyles.sectionCard} data-testid="ai-audit-panel">
      <div className={coreStyles.sectionHeader}>
        <div>
          <h2 className={coreStyles.sectionTitle}>AI dispatch audit</h2>
          <p className={coreStyles.sectionSubtitle}>
            A second opinion on what to dispatch next, urgent batches and supply risks. Farmer names are never sent.
          </p>
        </div>
        <div className={coreStyles.inlineRow}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Sparkles size={15} />}
            isLoading={audit.isPending}
            disabled={audit.isPending}
            onClick={() => audit.mutate(false)}
            data-testid="ai-audit-run-btn"
          >
            Run audit
          </Button>
          {audit.data ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={15} />}
              disabled={audit.isPending}
              onClick={() => audit.mutate(true)}
              data-testid="ai-audit-refresh-btn"
            >
              Run again
            </Button>
          ) : null}
        </div>
      </div>

      {audit.isError ? (
        <div className={`${coreStyles.alertBanner} ${coreStyles.alertWarning}`} role="alert" data-testid="ai-audit-error">
          {audit.error instanceof Error ? audit.error.message : 'The AI audit could not run.'}
        </div>
      ) : null}

      {audit.data ? <ReportView report={audit.data} /> : null}
      {audit.data && (audit.data.top3Priorities ?? []).length > 0 ? (
        <p className={coreStyles.metaLabel}>
          Open a batch from the queue below, or see <Link to="/batches">all batches</Link>.
        </p>
      ) : null}
    </section>
  );
}
