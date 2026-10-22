import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMessage, editMessage } from '../../api/endpoints';
import { useToast } from '../../components/ui';

/** Post, edit and delete for one conversation; every success refetches that conversation. */
export function useMessageActions(queryKey: readonly unknown[], post: (body: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...queryKey] });
  const fail = (title: string) => (err: unknown) =>
    pushToast({ title, description: err instanceof Error ? err.message : undefined, variant: 'error' });

  const postMutation = useMutation({ mutationFn: post, onSuccess: refresh, onError: fail('Message not sent') });
  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => editMessage(id, body),
    onSuccess: refresh,
    onError: fail('Edit not saved')
  });
  const deleteMutation = useMutation({ mutationFn: deleteMessage, onSuccess: refresh, onError: fail('Message not deleted') });

  return {
    isPosting: postMutation.isPending,
    onPost: (body: string) => postMutation.mutateAsync(body),
    onEdit: (id: string, body: string) => editMutation.mutateAsync({ id, body }),
    onDelete: (id: string) => deleteMutation.mutateAsync(id)
  };
}
