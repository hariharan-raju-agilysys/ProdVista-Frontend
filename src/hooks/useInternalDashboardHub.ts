import { useEffect, useState, useCallback, useRef } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { authService } from '../services/authService';
import type { DashboardSummary } from '../services/internalDashboardService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export type SummarySection = 'db' | 'devops' | 'jenkins';

interface StreamChunk {
  section: SummarySection;
  data: unknown;
  generatedAt: string;
}

interface UseInternalDashboardHubOptions {
  onSectionLoaded?: (section: SummarySection) => void;
}

export function useInternalDashboardHub(opts: UseInternalDashboardHubOptions = {}) {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSections, setLoadedSections] = useState<Set<SummarySection>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Create connection
  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/internal-dashboard`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    conn.onclose(() => setIsConnected(false));
    conn.onreconnected(() => setIsConnected(true));
    conn.onreconnecting(() => setIsConnected(false));

    setConnection(conn);

    conn.start()
      .then(() => setIsConnected(true))
      .catch(err => {
        console.error('[DashboardHub] Connection failed:', err);
        setError('SignalR connection failed');
      });

    return () => { conn.stop(); };
  }, []);

  const streamSummary = useCallback(async (connectionId?: string) => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      setError('Not connected');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadedSections(new Set());

    // Build partial summary progressively
    const partial: Partial<DashboardSummary> = {
      devops: { connected: false },
      jenkins: { connected: false },
      customers: { total: 0 },
      team: { totalMembers: 0 },
      support: { openIncidents: 0 },
      birthdays: [],
      knowledgeSharesCount: 0,
      apiCatalogCount: 0,
      generatedAt: new Date().toISOString(),
    };

    try {
      const stream = connection.stream<StreamChunk>('StreamSummary', connectionId ?? null);

      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next(chunk) {
            if (chunk.section === 'db' && chunk.data) {
              const db = chunk.data as Record<string, unknown>;
              Object.assign(partial, {
                customers: db.customers ?? partial.customers,
                team: db.team ?? partial.team,
                support: db.support ?? partial.support,
                birthdays: db.birthdays ?? partial.birthdays,
                knowledgeSharesCount: db.knowledgeSharesCount ?? 0,
                apiCatalogCount: db.apiCatalogCount ?? 0,
                generatedAt: chunk.generatedAt,
              });
            } else if (chunk.section === 'devops') {
              partial.devops = chunk.data as DashboardSummary['devops'];
              partial.generatedAt = chunk.generatedAt;
            } else if (chunk.section === 'jenkins') {
              partial.jenkins = chunk.data as DashboardSummary['jenkins'];
              partial.generatedAt = chunk.generatedAt;
            }

            setLoadedSections(prev => new Set([...prev, chunk.section]));
            setSummary({ ...partial } as DashboardSummary);
            optsRef.current.onSectionLoaded?.(chunk.section);
          },
          error(err) { reject(err); },
          complete() { resolve(); },
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stream failed';
      console.error('[DashboardHub] Stream error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  return { isConnected, summary, loading, loadedSections, error, streamSummary };
}
