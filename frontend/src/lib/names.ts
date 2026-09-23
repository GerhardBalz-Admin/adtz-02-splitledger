import type { Member } from '../api/types';

/** "You" for the signed-in user, otherwise the member's display name. */
export function memberName(members: Member[], memberId: string, currentUserId: string): string {
  if (memberId === currentUserId) return 'You';
  return members.find((m) => m.id === memberId)?.displayName ?? 'Former member';
}

/** "you, Anna, Ben" or "everyone". */
export function participantSummary(members: Member[], participantIds: string[], currentUserId: string): string {
  if (participantIds.length === members.length && members.length > 1) return 'everyone';
  return participantIds
    .map((id) => (id === currentUserId ? 'you' : memberName(members, id, currentUserId)))
    .join(', ');
}
