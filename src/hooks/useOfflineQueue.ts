import { useCallback, useEffect, useRef, useState } from 'react';
import { kioskApi } from '../api';
import { useConfig } from '../state/ConfigContext';

export interface PendingToggle {
  id: string;
  member_id: string;
  team_id: string;
  created_at: number;
}

const STORAGE_KEY = 'ftc_attendance_queue_v1';
const MAX_RETRY_DELAY = 60_000;

const readQueue = (): PendingToggle[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingToggle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read queue', error);
    return [];
  }
};

const writeQueue = (queue: PendingToggle[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const useOfflineQueue = (season_id: string) => {
  const config = useConfig();
  const [queue, setQueue] = useState<PendingToggle[]>(() => readQueue());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const retryTimeout = useRef<number>();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    writeQueue(queue);
  }, [queue]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine || queue.length === 0) {
      return;
    }

    const [next, ...rest] = queue;
    try {
      await kioskApi.toggle(season_id, next.team_id, next.member_id, next.id);
      setQueue(rest);
      window.dispatchEvent(new CustomEvent('queue:flushed'));
    } catch (error) {
      console.error('Failed to flush queue', error);
      const delay = Math.min(MAX_RETRY_DELAY, Math.max(2000, Date.now() - next.created_at));
      window.clearTimeout(retryTimeout.current);
      retryTimeout.current = window.setTimeout(flushQueue, delay);
    }
  }, [queue, season_id]);

  useEffect(() => {
    if (isOnline) {
      flushQueue().catch((error) => console.error('Failed to flush queue', error));
    }
  }, [isOnline, flushQueue]);

  const enqueue = useCallback(
    (member_id: string, team_id: string) => {
      const entry: PendingToggle = {
        id: crypto.randomUUID(),
        member_id,
        team_id,
        created_at: Date.now(),
      };
      setQueue((prev) => [...prev, entry]);
      flushQueue().catch((error) => console.error('Failed to flush queue', error));
    },
    [flushQueue],
  );

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    isOnline,
    enqueue,
    flushQueue,
    clear,
    kioskUrl: config.GAS_URL,
  };
};
