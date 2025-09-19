import { useEffect, useState } from 'react';

export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState<number>(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateQueue = () => {
      try {
        const raw = localStorage.getItem('ftc_attendance_queue_v1');
        if (!raw) {
          setQueuedCount(0);
          return;
        }
        const parsed = JSON.parse(raw) as unknown[];
        setQueuedCount(parsed.length);
      } catch (error) {
        console.error('Failed to read queue length', error);
      }
    };

    updateQueue();

    window.addEventListener('queue:flushed', updateQueue);
    const interval = window.setInterval(updateQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('queue:flushed', updateQueue);
      window.clearInterval(interval);
    };
  }, []);

  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div
      className={`text-white text-center text-sm py-2 ${isOnline ? 'bg-amber-600' : 'bg-danger'}`}
      role="status"
    >
      {isOnline
        ? `Submitting ${queuedCount} queued change${queuedCount === 1 ? '' : 's'}…`
        : 'Offline mode: actions will sync when back online.'}
    </div>
  );
};
