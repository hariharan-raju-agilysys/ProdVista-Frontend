import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';

/**
 * SignalR-based token synchronization service
 * Broadcasts token updates across all browser tabs for the same user
 */
class TokenSyncService {
  private connection: HubConnection | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  /**
   * Initializes SignalR connection to TokenSyncHub
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.connection) {
      return;
    }

    try {
      const token = sessionStorage.getItem('prodvista_auth_token');
      if (!token) {
        console.warn('Cannot connect to TokenSync - no auth token');
        return;
      }

      this.connection = new HubConnectionBuilder()
        .withUrl('/hubs/token-sync', {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount >= this.MAX_RECONNECT_ATTEMPTS) {
              return null; // Stop reconnecting
            }
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 16000);
          },
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Register event handlers
      this.registerEventHandlers();

      await this.connection.start();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ TokenSync connected');
    } catch (error) {
      console.error('TokenSync connection failed:', error);
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Registers SignalR event handlers for token updates
   */
  private registerEventHandlers(): void {
    if (!this.connection) return;

    // Handle token updates from other tabs
    this.connection.on('TokenUpdated', (encryptedToken: string, salt: string, expiresAt: number) => {
      console.log('📡 TokenSync: Received token update from another tab');
      sessionStorage.setItem('prodvista_devops_token_encrypted', encryptedToken);
      sessionStorage.setItem('prodvista_devops_token_salt', salt);
      sessionStorage.setItem('prodvista_devops_token_expires', expiresAt.toString());
      
      // Dispatch custom event for components to react
      window.dispatchEvent(new CustomEvent('devopsTokenUpdated', { 
        detail: { expiresAt } 
      }));
    });

    // Handle token clear from other tabs
    this.connection.on('TokenCleared', () => {
      console.log('📡 TokenSync: Received token clear from another tab');
      sessionStorage.removeItem('prodvista_devops_token_encrypted');
      sessionStorage.removeItem('prodvista_devops_token_salt');
      sessionStorage.removeItem('prodvista_devops_token_expires');
      sessionStorage.removeItem('prodvista_devops_token');
      
      window.dispatchEvent(new CustomEvent('devopsTokenCleared'));
    });

    // Handle token expiring warning
    this.connection.on('TokenExpiring', (expiresAt: number) => {
      console.log('⏰ TokenSync: Token expiring soon');
      window.dispatchEvent(new CustomEvent('devopsTokenExpiring', { 
        detail: { expiresAt } 
      }));
    });

    // Handle reconnection
    this.connection.onreconnecting(() => {
      this.isConnected = false;
      this.reconnectAttempts++;
      console.warn(`TokenSync reconnecting... (attempt ${this.reconnectAttempts})`);
    });

    this.connection.onreconnected(() => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ TokenSync reconnected');
    });

    this.connection.onclose((error) => {
      this.isConnected = false;
      console.error('TokenSync connection closed:', error);
    });
  }

  /**
   * Broadcasts token update to other tabs
   */
  async broadcastTokenUpdate(encryptedToken: string, salt: string, expiresAt: number): Promise<void> {
    if (!this.connection || !this.isConnected) {
      console.warn('TokenSync not connected - skipping broadcast');
      return;
    }

    try {
      await this.connection.invoke('BroadcastTokenUpdate', encryptedToken, salt, expiresAt);
      console.log('📤 TokenSync: Broadcasted token update');
    } catch (error) {
      console.error('Failed to broadcast token update:', error);
    }
  }

  /**
   * Broadcasts token clear to other tabs
   */
  async broadcastTokenClear(): Promise<void> {
    if (!this.connection || !this.isConnected) {
      return;
    }

    try {
      await this.connection.invoke('BroadcastTokenClear');
      console.log('📤 TokenSync: Broadcasted token clear');
    } catch (error) {
      console.error('Failed to broadcast token clear:', error);
    }
  }

  /**
   * Broadcasts token expiring warning to other tabs
   */
  async broadcastTokenExpiring(expiresAt: number): Promise<void> {
    if (!this.connection || !this.isConnected) {
      return;
    }

    try {
      await this.connection.invoke('BroadcastTokenExpiring', expiresAt);
      console.log('📤 TokenSync: Broadcasted token expiring warning');
    } catch (error) {
      console.error('Failed to broadcast token expiring:', error);
    }
  }

  /**
   * Disconnects from TokenSyncHub
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
        this.connection = null;
        this.isConnected = false;
        console.log('TokenSync disconnected');
      } catch (error) {
        console.error('Error disconnecting TokenSync:', error);
      }
    }
  }

  /**
   * Checks if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const tokenSyncService = new TokenSyncService();
