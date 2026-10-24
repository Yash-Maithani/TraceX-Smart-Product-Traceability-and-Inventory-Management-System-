import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { fetchChannelMessages, fetchMessageChannels, postChannelMessage } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '../../components/ui';
import { STRINGS } from '../../strings/en';
import { MESSAGE_STRINGS as S } from '../../strings/inbox';
import { MessageThread } from './MessageThread';
import { useMessageActions } from './useMessageActions';

function channelLabel(role: string): string {
  return (STRINGS.roles as Record<string, string>)[role] ?? role;
}

function ChannelView({ role, canModerate }: { role: string; canModerate: boolean }) {
  const queryKey = ['messages', 'channel', role] as const;
  const query = useQuery({ queryKey, queryFn: () => fetchChannelMessages(role) });
  const actions = useMessageActions(queryKey, (body) => postChannelMessage(role, body));

  if (query.isLoading) return <Skeleton label={S.loadingMessages} />;
  if (query.isError) {
    return (
      <ErrorState
        title={S.errorChannel}
        description={query.error instanceof Error ? query.error.message : S.errorBody}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <MessageThread
      messages={query.data ?? []}
      composerLabel={S.composerLabel(channelLabel(role))}
      emptyTitle={S.emptyTitle}
      emptyDescription={S.emptyBody}
      canModerate={canModerate}
      testIdPrefix="channel"
      {...actions}
    />
  );
}

/**
 * Messages (Phase 10.1): one channel per role. Users see their own role's channel; a super-admin sees
 * all five. Channel messages are deleted after 90 days; decisions belong in record comments instead.
 */
export function MessagesPage() {
  const { user } = useAuth();
  const channelsQuery = useQuery({ queryKey: ['messages', 'channels'], queryFn: fetchMessageChannels });
  const channels = channelsQuery.data?.channels ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? channels[0] ?? null; // first channel until one is picked
  const canModerate = user?.superAdmin === true || user?.role === 'admin';

  const retention = channelsQuery.data?.retentionDays ?? 90;

  return (
    <div className={coreStyles.pageStack} data-testid="messages-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle(retention)}
        backdropKey="notifications"
        priority
      />

      {channelsQuery.isLoading ? (
        <Skeleton label={S.loadingChannels} />
      ) : channelsQuery.isError ? (
        <ErrorState
          title={S.errorChannels}
          description={channelsQuery.error instanceof Error ? channelsQuery.error.message : S.errorBody}
          onRetry={() => void channelsQuery.refetch()}
        />
      ) : channels.length === 0 ? (
        <EmptyState title={S.noChannelsTitle} description={S.noChannelsBody} />
      ) : (
        <>
          {channels.length > 1 ? (
            <Tabs
              label={S.channelsLabel}
              idPrefix="channel"
              selectedId={active ?? ''}
              onSelect={setPicked}
              tabs={channels.map((c) => ({
                id: c,
                label: channelLabel(c),
                count: channelsQuery.data?.activity?.[c]?.total || undefined,
                testId: `channel-tab-${c}`
              }))}
            />
          ) : null}

          {active ? (
            <section
              className={coreStyles.sectionCard}
              data-testid={`channel-panel-${active}`}
              id={`channel-panel-${active}`}
              role={channels.length > 1 ? 'tabpanel' : undefined}
              aria-labelledby={channels.length > 1 ? `channel-tab-${active}` : undefined}
            >
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{S.channelTitle(channelLabel(active))}</h2>
                  <p className={coreStyles.sectionSubtitle}>{S.members(channelsQuery.data?.memberCounts?.[active] ?? 0)}</p>
                </div>
              </div>
              <ChannelView key={active} role={active} canModerate={canModerate} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
