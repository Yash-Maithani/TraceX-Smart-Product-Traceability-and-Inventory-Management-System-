import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { fetchChannelMessages, fetchMessageChannels, postChannelMessage } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { STRINGS } from '../../strings/en';
import { MessageThread } from './MessageThread';
import { useMessageActions } from './useMessageActions';

function channelLabel(role: string): string {
  return (STRINGS.roles as Record<string, string>)[role] ?? role;
}

function ChannelView({ role, canModerate }: { role: string; canModerate: boolean }) {
  const queryKey = ['messages', 'channel', role] as const;
  const query = useQuery({ queryKey, queryFn: () => fetchChannelMessages(role) });
  const actions = useMessageActions(queryKey, (body) => postChannelMessage(role, body));

  if (query.isLoading) return <Skeleton label="Loading messages" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this channel"
        description={query.error instanceof Error ? query.error.message : 'Please try again.'}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <MessageThread
      messages={query.data ?? []}
      composerLabel={`Message the ${channelLabel(role)} channel`}
      emptyTitle="No messages yet"
      emptyDescription="Use this channel for shift handover and coordination."
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
        title="Messages"
        subtitle={`Role channels for coordination. Messages are kept for ${retention} days; comment on a batch or inspection for anything that should stay on record.`}
        backdropKey="notifications"
        priority
      />

      {channelsQuery.isLoading ? (
        <Skeleton label="Loading channels" />
      ) : channelsQuery.isError ? (
        <ErrorState
          title="Could not load channels"
          description={channelsQuery.error instanceof Error ? channelsQuery.error.message : 'Please try again.'}
          onRetry={() => void channelsQuery.refetch()}
        />
      ) : channels.length === 0 ? (
        <EmptyState title="No channels" description="Your account has no role channel." />
      ) : (
        <>
          {channels.length > 1 ? (
            <div className={coreStyles.tabBar} role="tablist" aria-label="Channels">
              {channels.map((c) => {
                const activity = channelsQuery.data?.activity?.[c];
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={active === c}
                    className={`${coreStyles.tabBtn} ${active === c ? coreStyles.tabBtnActive : ''}`}
                    onClick={() => setPicked(c)}
                    data-testid={`channel-tab-${c}`}
                    title={activity ? `Last message ${formatTimestamp(activity.lastAt)}` : 'No messages yet'}
                  >
                    {channelLabel(c)}
                    {activity?.total ? ` (${activity.total})` : ''}
                  </button>
                );
              })}
            </div>
          ) : null}

          {active ? (
            <section className={coreStyles.sectionCard} data-testid={`channel-panel-${active}`}>
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{channelLabel(active)} channel</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    {channelsQuery.data?.memberCounts?.[active] ?? 0} active members can read this channel.
                  </p>
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
