import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';
import styles from './fefo.module.css';
import batchStyles from '../batches/batches.module.css';
import { fetchAiStatus, fetchDispatchAdvice } from '../../api/endpoints';
import type { AiDispatchAdviceDto } from '../../api/types';
import { Button, Skeleton } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { AI_STRINGS } from '../../strings/ai';

const S = AI_STRINGS.brief;
const LIST_CAP = 5;

type Flagged = NonNullable<AiDispatchAdviceDto['urgent']>[number];

function FlagGroup({ title, items, testId }: { title: string; items: Flagged[]; testId: string }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.briefGroup} data-testid={testId}>
      <h4 className={styles.briefGroupTitle}>
        {title} <span className={batchStyles.countChip}>{items.length}</span>
      </h4>
      <ul className={styles.briefList}>
        {items.slice(0, LIST_CAP).map((b) => (
          <li key={b.batchCode}>
            <span className={batchStyles.mono}>{b.batchCode}</span> <span>{b.productName}</span>
            <span className={batchStyles.muted}>{b.reason}</span>
          </li>
        ))}
        {items.length > LIST_CAP ? <li className={batchStyles.muted}>{S.more(items.length - LIST_CAP)}</li> : null}
      </ul>
    </div>
  );
}

/**
 * Dispatch brief (AI phase). The facts come from the server's rules and always show; the AI summary is
 * an extra the person asks for, shown only when an AI key is configured. Nothing here dispatches anything.
 */
export function DispatchBriefPanel() {
  const statusQuery = useQuery({ queryKey: ['ai', 'status'], queryFn: fetchAiStatus, staleTime: 300_000 });
  // The brief shares the 'fefo' key prefix so a dispatch or inspection refreshes it with the queue
  const factsQuery = useQuery({
    queryKey: ['fefo', 'brief'],
    queryFn: () => fetchDispatchAdvice({ withAi: false })
  });
  const summary = useMutation({ mutationFn: (refresh: boolean) => fetchDispatchAdvice({ withAi: true, refresh }) });

  const advice = summary.data ?? factsQuery.data;
  const aiEnabled = statusQuery.data?.enabled === true;

  if (factsQuery.isPending) {
    return (
      <section className={styles.panel} aria-busy="true">
        <Skeleton label={S.loading} />
      </section>
    );
  }
  if (factsQuery.isError || !advice) {
    return (
      <section className={styles.panel} role="status">
        <p className={styles.intro}>{S.error}</p>
      </section>
    );
  }

  const next = advice.nextToShip ?? [];
  const urgent = advice.urgent ?? [];
  const onHold = advice.onHold ?? [];
  const expired = advice.expired ?? [];
  const quality = advice.qualityWarnings ?? [];
  const nothingFlagged = urgent.length + onHold.length + expired.length + quality.length === 0;
  const ai = advice.ai;
  const note = summary.data?.aiNote ? S.aiNotes[summary.data.aiNote] : null;

  return (
    <section className={styles.panel} aria-labelledby="dispatch-brief-title" data-testid="dispatch-brief">
      <div>
        <h2 id="dispatch-brief-title" className={styles.briefTitle}>
          {S.title}
        </h2>
        <p className={styles.intro}>{S.subtitle}</p>
      </div>

      <div className={styles.briefColumns}>
        <div className={styles.briefGroup} data-testid="dispatch-brief-next">
          <h3 className={styles.briefGroupTitle}>{S.shipNext}</h3>
          <p className={batchStyles.muted}>{S.shipNextNote}</p>
          {next.length === 0 ? (
            <p className={batchStyles.muted}>{S.nothingToShip}</p>
          ) : (
            <ol className={styles.briefList}>
              {next.slice(0, LIST_CAP + 1).map((b) => (
                <li key={b.batchCode}>
                  <span className={batchStyles.mono}>{b.batchCode}</span> <span>{b.productName}</span>
                  <span className={batchStyles.muted}>{S.daysLeft(b.daysUntilExpiry ?? undefined)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className={styles.briefGroup} data-testid="dispatch-brief-attention">
          <h3 className={styles.briefGroupTitle}>{S.attention}</h3>
          {nothingFlagged ? <p className={batchStyles.muted}>{S.allClear}</p> : null}
          <FlagGroup title={S.groups.onHold} items={onHold} testId="dispatch-brief-hold" />
          <FlagGroup title={S.groups.urgent} items={urgent} testId="dispatch-brief-urgent" />
          <FlagGroup title={S.groups.expired} items={expired} testId="dispatch-brief-expired" />
          <FlagGroup title={S.groups.quality} items={quality} testId="dispatch-brief-quality" />
        </div>
      </div>

      {aiEnabled ? (
        <div className={styles.aiBlock} data-testid="dispatch-brief-ai">
          <div className={styles.aiHead}>
            <div>
              <h3 className={styles.briefGroupTitle}>{S.aiTitle}</h3>
              {!ai ? <p className={batchStyles.muted}>{S.aiIntro}</p> : null}
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={ai ? <RefreshCw size={15} /> : <Sparkles size={15} />}
              isLoading={summary.isPending}
              disabled={summary.isPending}
              onClick={() => summary.mutate(Boolean(ai))}
              data-testid="dispatch-brief-ai-btn"
            >
              {ai ? S.aiRunAgain : S.aiRun}
            </Button>
          </div>
          {note ? (
            <p className={styles.holdNote} role="status" data-testid="dispatch-brief-ai-note">
              {note}
            </p>
          ) : null}
          {summary.isError ? (
            <p className={styles.holdNote} role="status">
              {S.aiNotes.unavailable}
            </p>
          ) : null}
          {ai ? (
            <div className={styles.aiBody}>
              <p data-testid="dispatch-brief-ai-summary">{ai.summary}</p>
              {(ai.risks ?? []).length > 0 ? (
                <>
                  <h4 className={styles.briefGroupTitle}>{S.aiRisks}</h4>
                  <ul className={styles.briefList}>
                    {(ai.risks ?? []).map((r) => (
                      <li key={r.risk}>
                        <span className={styles.severity}>{S.severity[r.severity ?? 'MEDIUM'] ?? r.severity}</span>{' '}
                        <span>{r.risk}</span>
                        {r.recommendation ? <span className={batchStyles.muted}>{r.recommendation}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className={batchStyles.muted}>
                {S.aiMeta(AI_STRINGS.providers[ai.provider ?? ''] ?? ai.provider ?? '', formatTimestamp(ai.generatedAt), Boolean(ai.fromCache))}{' '}
                {S.aiDisclaimer}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
