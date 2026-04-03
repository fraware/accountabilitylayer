import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

interface NotifierState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

const NotifierContext = createContext<NotifierState>({
  connectionStatus: 'disconnected',
});

const notifierUrl = import.meta.env.VITE_NOTIFIER_URL || 'http://localhost:3001';

export function NotifierProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<NotifierState['connectionStatus']>('disconnected');

  const invalidateLogSearches = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === 'logs' && q.queryKey[1] === 'search',
    });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionStatus('disconnected');
      return;
    }

    const socket = io(notifierUrl, { autoConnect: false });
    socketRef.current = socket;

    const onLiveChange = () => {
      invalidateLogSearches();
    };

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('log-created', onLiveChange);
    socket.on('log-updated', onLiveChange);
    socket.on('bulk-logs-created', onLiveChange);

    setConnectionStatus('connecting');
    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('log-created', onLiveChange);
      socket.off('log-updated', onLiveChange);
      socket.off('bulk-logs-created', onLiveChange);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [enabled, invalidateLogSearches]);

  const value: NotifierState = { connectionStatus };

  return <NotifierContext.Provider value={value}>{children}</NotifierContext.Provider>;
}

export function useNotifier(): NotifierState {
  return useContext(NotifierContext);
}
