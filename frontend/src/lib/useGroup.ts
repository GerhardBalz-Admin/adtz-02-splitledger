import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { GroupDetail } from '../api/types';
import { useAuth } from '../auth';
import { errorMessage } from './errors';

interface GroupState {
  group: GroupDetail | null;
  error: string | null;
  notFound: boolean;
  reload: () => Promise<void>;
}

/** Loads one group the signed-in user belongs to. Nonmembers get `notFound`. */
export function useGroup(groupId: string | undefined): GroupState {
  const { forget } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    if (!groupId) return;
    try {
      setGroup(await api.getGroup(groupId));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else if (err instanceof ApiError && err.status === 401) {
        forget();
        navigate('/signin', { replace: true });
      } else setError(errorMessage(err));
    }
  }, [groupId, forget, navigate]);

  useEffect(() => {
    setGroup(null);
    setNotFound(false);
    void reload();
  }, [reload]);

  return { group, error, notFound, reload };
}
