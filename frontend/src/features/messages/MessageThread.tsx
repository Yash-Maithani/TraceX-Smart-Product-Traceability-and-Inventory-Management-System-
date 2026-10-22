import { useState } from 'react';
import { Pencil, Send, Trash2 } from 'lucide-react';
import coreStyles from '../core/core.module.css';
import type { MessageDto } from '../../api/types';
import { Button, EmptyState, Field, Textarea } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { STRINGS } from '../../strings/en';

const MAX_BODY = 2000;

export interface MessageThreadProps {
  messages: MessageDto[];
  /** Label for the composer, e.g. "Add a comment". */
  composerLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Admins and super-admins may remove anyone's message (moderation). */
  canModerate: boolean;
  isPosting: boolean;
  onPost: (body: string) => Promise<unknown>;
  onEdit: (id: string, body: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  testIdPrefix: string;
}

function roleLabel(role?: string): string {
  if (!role) return '';
  return (STRINGS.roles as Record<string, string>)[role] ?? role;
}

/**
 * Shared list + composer for role channels and record comments (Phase 10.1).
 * Only the author sees Edit; the author and moderators see Delete. Deleted messages keep their
 * place and read "Message deleted", matching the server's soft delete.
 */
export function MessageThread({
  messages,
  composerLabel,
  emptyTitle,
  emptyDescription,
  canModerate,
  isPosting,
  onPost,
  onEdit,
  onDelete,
  testIdPrefix
}: MessageThreadProps) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    await onPost(body);
    setDraft('');
  };

  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    await onEdit(id, body);
    setEditingId(null);
  };

  return (
    <div className={coreStyles.pageStack}>
      {messages.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className={coreStyles.timelineList} data-testid={`${testIdPrefix}-list`}>
          {messages.map((m) => (
            <li key={m.id} className={coreStyles.timelineItem} data-testid={`${testIdPrefix}-item`}>
              <div className={coreStyles.timelineHeader}>
                <span>
                  <strong>{m.authorName}</strong>
                  {m.authorRole ? <span className={coreStyles.metaLabel}> · {roleLabel(m.authorRole)}</span> : null}
                </span>
                <span className={coreStyles.metaLabel}>
                  {formatTimestamp(m.createdAt)}
                  {m.editCount ? ' (edited)' : ''}
                </span>
              </div>

              {m.deleted ? (
                <p className={coreStyles.metaLabel}>Message deleted</p>
              ) : editingId === m.id ? (
                <div className={coreStyles.pageStack}>
                  <Field label="Edit message">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={MAX_BODY}
                      rows={3}
                      data-testid={`${testIdPrefix}-edit-input`}
                    />
                  </Field>
                  <div className={coreStyles.inlineRow}>
                    <Button variant="primary" size="sm" onClick={() => void saveEdit(m.id!)} data-testid={`${testIdPrefix}-edit-save`}>
                      Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{m.body}</p>
              )}

              {!m.deleted && editingId !== m.id && m.id ? (
                <div className={coreStyles.inlineRow}>
                  {m.mine ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Pencil size={14} />}
                      onClick={() => {
                        setEditingId(m.id!);
                        setEditDraft(m.body ?? '');
                      }}
                      data-testid={`${testIdPrefix}-edit-btn`}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {m.mine || canModerate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => void onDelete(m.id!)}
                      data-testid={`${testIdPrefix}-delete-btn`}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className={coreStyles.pageStack}
        noValidate
      >
        <Field label={composerLabel} hint={`${draft.length} / ${MAX_BODY} characters`}>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
            disabled={isPosting}
            data-testid={`${testIdPrefix}-input`}
          />
        </Field>
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<Send size={14} />}
            isLoading={isPosting}
            disabled={isPosting || draft.trim().length === 0}
            data-testid={`${testIdPrefix}-send-btn`}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
