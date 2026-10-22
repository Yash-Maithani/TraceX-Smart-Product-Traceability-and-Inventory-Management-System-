import { useQuery } from '@tanstack/react-query';
import { fetchRecordComments, postRecordComment } from '../../api/endpoints';
import type { MessageRefType } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorState, Skeleton } from '../../components/ui';
import { MessageThread } from './MessageThread';
import { useMessageActions } from './useMessageActions';

/**
 * Comments on one batch or inspection (Phase 10.1). Kept permanently as part of the record.
 */
export function RecordComments({ refType, refId }: { refType: MessageRefType; refId: string }) {
  const { user } = useAuth();
  const queryKey = ['messages', 'record', refType, refId] as const;
  const query = useQuery({ queryKey, queryFn: () => fetchRecordComments(refType, refId) });
  const actions = useMessageActions(queryKey, (body) => postRecordComment(refType, refId, body));
  const canModerate = user?.superAdmin === true || user?.role === 'admin';

  if (query.isLoading) return <Skeleton label="Loading comments" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load comments"
        description={query.error instanceof Error ? query.error.message : 'Please try again.'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <MessageThread
      messages={query.data ?? []}
      composerLabel="Add a comment"
      emptyTitle="No comments yet"
      emptyDescription={`Comments explain decisions about this ${refType} and are kept with it permanently.`}
      canModerate={canModerate}
      testIdPrefix={`${refType}-comments`}
      {...actions}
    />
  );
}
