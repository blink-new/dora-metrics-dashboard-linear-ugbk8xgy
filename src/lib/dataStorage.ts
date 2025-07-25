import { blink } from '../blink/client';
import { LinearIssue, LinearCycle } from './linearApi';
import { DORAMetrics, LeadTimeAnalysis, EstimationAnalysis, CodeReviewAnalysis } from './doraCalculator';

export interface DataSnapshot {
  id: string;
  user_id: string;
  team_id: string | null;
  cycle_id: string | null;
  period: string;
  snapshot_date: string;
  issues_data: string; // JSON stringified LinearIssue[]
  metrics_data: string; // JSON stringified metrics
  created_at: string;
  updated_at: string;
}

export interface TrendComparison {
  current: {
    date: string;
    metrics: DORAMetrics;
    issueCount: number;
  };
  previous: {
    date: string;
    metrics: DORAMetrics;
    issueCount: number;
  } | null;
  trends: {
    deploymentFrequency: number;
    leadTime: number;
    changeFailureRate: number;
    timeToRecovery: number;
  };
}

export interface DataCacheConfig {
  refreshIntervalMinutes: number;
  maxCacheAge: number; // in milliseconds
  enableAutoRefresh: boolean;
}

class DataStorageService {
  private defaultConfig: DataCacheConfig = {
    refreshIntervalMinutes: 60, // 1 hour default
    maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
    enableAutoRefresh: true
  };

  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Save a data snapshot to the database
   */
  async saveSnapshot(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string,
    issues: LinearIssue[],
    metrics: {
      doraMetrics: DORAMetrics;
      leadTimeAnalysis: LeadTimeAnalysis;
      estimationAnalysis: EstimationAnalysis;
      codeReviewAnalysis: CodeReviewAnalysis;
    }
  ): Promise<string> {
    const snapshotId = `snapshot_${userId}_${teamId || 'all'}_${cycleId || 'all'}_${period}_${Date.now()}`;
    const now = new Date().toISOString();

    try {
      console.log('Attempting to save snapshot with ID:', snapshotId);
      console.log('Snapshot data:', {
        user_id: userId,
        team_id: teamId,
        cycle_id: cycleId,
        period,
        issues_count: issues.length,
        metrics_keys: Object.keys(metrics)
      });

      await blink.db.data_snapshots.create({
        id: snapshotId,
        user_id: userId,
        team_id: teamId,
        cycle_id: cycleId,
        period,
        snapshot_date: now,
        issues_data: JSON.stringify(issues),
        metrics_data: JSON.stringify(metrics),
        created_at: now,
        updated_at: now
      });

      console.log('Snapshot saved successfully to database');
      return snapshotId;
    } catch (error) {
      console.error('Error saving data snapshot:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to save data snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the latest snapshot for given parameters
   */
  async getLatestSnapshot(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<DataSnapshot | null> {
    try {
      const snapshots = await blink.db.data_snapshots.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        orderBy: { created_at: 'desc' },
        limit: 1
      });

      return snapshots.length > 0 ? snapshots[0] : null;
    } catch (error) {
      console.error('Error getting latest snapshot:', error);
      return null;
    }
  }

  /**
   * Check if cached data is still fresh
   */
  isCacheFresh(snapshot: DataSnapshot, config: DataCacheConfig = this.defaultConfig): boolean {
    const snapshotAge = Date.now() - new Date(snapshot.created_at).getTime();
    return snapshotAge < config.maxCacheAge;
  }

  /**
   * Get historical snapshots for trend analysis
   */
  async getHistoricalSnapshots(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string,
    daysBack: number = 30
  ): Promise<DataSnapshot[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    try {
      const snapshots = await blink.db.data_snapshots.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        orderBy: { created_at: 'desc' },
        limit: 50 // Reasonable limit for trend analysis
      });

      // Filter by date and return only snapshots within the specified period
      return snapshots.filter(snapshot => 
        new Date(snapshot.created_at) >= cutoffDate
      );
    } catch (error) {
      console.error('Error getting historical snapshots:', error);
      return [];
    }
  }

  /**
   * Calculate trend comparison between current and previous periods
   */
  async calculateTrendComparison(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<TrendComparison | null> {
    try {
      const snapshots = await this.getHistoricalSnapshots(userId, teamId, cycleId, period, 60);
      
      if (snapshots.length < 2) {
        return null; // Need at least 2 snapshots for comparison
      }

      const current = snapshots[0];
      const previous = snapshots[1];

      const currentMetrics = JSON.parse(current.metrics_data || '{}').doraMetrics as DORAMetrics;
      const previousMetrics = JSON.parse(previous.metrics_data || '{}').doraMetrics as DORAMetrics;
      
      const currentIssues = JSON.parse(current.issues_data || '[]') as LinearIssue[];
      const previousIssues = JSON.parse(previous.issues_data || '[]') as LinearIssue[];

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        current: {
          date: current.snapshot_date,
          metrics: currentMetrics,
          issueCount: currentIssues.length
        },
        previous: {
          date: previous.snapshot_date,
          metrics: previousMetrics,
          issueCount: previousIssues.length
        },
        trends: {
          deploymentFrequency: calculateChange(
            currentMetrics.deploymentFrequency.value,
            previousMetrics.deploymentFrequency.value
          ),
          leadTime: -calculateChange( // Negative because lower is better
            currentMetrics.leadTimeForChanges.value,
            previousMetrics.leadTimeForChanges.value
          ),
          changeFailureRate: -calculateChange( // Negative because lower is better
            currentMetrics.changeFailureRate.value,
            previousMetrics.changeFailureRate.value
          ),
          timeToRecovery: -calculateChange( // Negative because lower is better
            currentMetrics.timeToRecovery.value,
            previousMetrics.timeToRecovery.value
          )
        }
      };
    } catch (error) {
      console.error('Error calculating trend comparison:', error);
      return null;
    }
  }

  /**
   * Export data to JSON format
   */
  async exportData(
    userId: string,
    teamId: string | null = null,
    cycleId: string | null = null,
    daysBack: number = 90
  ): Promise<string> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const snapshots = await blink.db.data_snapshots.list({
        where: {
          user_id: userId,
          ...(teamId && { team_id: teamId }),
          ...(cycleId && { cycle_id: cycleId })
        },
        orderBy: { created_at: 'desc' },
        limit: 200 // Reasonable limit for export
      });

      const filteredSnapshots = snapshots.filter(snapshot => 
        new Date(snapshot.created_at) >= cutoffDate
      );

      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        teamId,
        cycleId,
        daysBack,
        snapshotCount: filteredSnapshots.length,
        snapshots: filteredSnapshots.map(snapshot => ({
          ...snapshot,
          issues_data: JSON.parse(snapshot.issues_data || '[]'),
          metrics_data: JSON.parse(snapshot.metrics_data || '{}')
        }))
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Import data from JSON format
   */
  async importData(userId: string, jsonData: string): Promise<number> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.snapshots || !Array.isArray(importData.snapshots)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;

      for (const snapshot of importData.snapshots) {
        try {
          // Check if snapshot already exists
          const existing = await blink.db.data_snapshots.list({
            where: {
              user_id: userId,
              team_id: snapshot.team_id,
              cycle_id: snapshot.cycle_id,
              period: snapshot.period,
              snapshot_date: snapshot.snapshot_date
            },
            limit: 1
          });

          if (existing.length === 0) {
            await blink.db.data_snapshots.create({
              id: snapshot.id || `imported_${Date.now()}_${Math.random()}`,
              user_id: userId,
              team_id: snapshot.team_id,
              cycle_id: snapshot.cycle_id,
              period: snapshot.period,
              snapshot_date: snapshot.snapshot_date,
              issues_data: typeof snapshot.issues_data === 'string' 
                ? snapshot.issues_data 
                : JSON.stringify(snapshot.issues_data),
              metrics_data: typeof snapshot.metrics_data === 'string'
                ? snapshot.metrics_data
                : JSON.stringify(snapshot.metrics_data),
              created_at: snapshot.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            importedCount++;
          }
        } catch (error) {
          console.warn('Error importing snapshot:', error);
        }
      }

      return importedCount;
    } catch (error) {
      console.error('Error importing data:', error);
      throw new Error('Failed to import data');
    }
  }

  /**
   * Clean up old snapshots to prevent database bloat
   */
  async cleanupOldSnapshots(userId: string, keepDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const oldSnapshots = await blink.db.data_snapshots.list({
        where: {
          user_id: userId
        },
        orderBy: { created_at: 'asc' },
        limit: 1000 // Process in batches
      });

      const snapshotsToDelete = oldSnapshots.filter(snapshot => 
        new Date(snapshot.created_at) < cutoffDate
      );

      let deletedCount = 0;
      for (const snapshot of snapshotsToDelete) {
        try {
          await blink.db.data_snapshots.delete(snapshot.id);
          deletedCount++;
        } catch (error) {
          console.warn('Error deleting snapshot:', snapshot.id, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old snapshots:', error);
      return 0;
    }
  }

  /**
   * Set up automatic refresh for a specific configuration
   */
  setupAutoRefresh(
    key: string,
    refreshCallback: () => Promise<void>,
    config: DataCacheConfig = this.defaultConfig
  ): void {
    if (!config.enableAutoRefresh) return;

    // Clear existing timer if any
    this.clearAutoRefresh(key);

    const intervalMs = config.refreshIntervalMinutes * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        await refreshCallback();
      } catch (error) {
        console.error('Auto refresh failed:', error);
      }
    }, intervalMs);

    this.refreshTimers.set(key, timer);
  }

  /**
   * Clear automatic refresh for a specific configuration
   */
  clearAutoRefresh(key: string): void {
    const timer = this.refreshTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(key);
    }
  }

  /**
   * Clear all automatic refresh timers
   */
  clearAllAutoRefresh(): void {
    this.refreshTimers.forEach((timer) => clearInterval(timer));
    this.refreshTimers.clear();
  }

  /**
   * Get cache statistics for a user
   */
  async getCacheStats(userId: string): Promise<{
    totalSnapshots: number;
    oldestSnapshot: string | null;
    newestSnapshot: string | null;
    totalSizeEstimate: number; // in bytes
  }> {
    try {
      const snapshots = await blink.db.data_snapshots.list({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        limit: 1000
      });

      const totalSizeEstimate = snapshots.reduce((total, snapshot) => {
        // Add null/undefined checks to prevent errors
        const issuesDataSize = snapshot.issues_data?.length || 0;
        const metricsDataSize = snapshot.metrics_data?.length || 0;
        return total + issuesDataSize + metricsDataSize;
      }, 0);

      return {
        totalSnapshots: snapshots.length,
        oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].created_at : null,
        newestSnapshot: snapshots.length > 0 ? snapshots[0].created_at : null,
        totalSizeEstimate
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalSnapshots: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        totalSizeEstimate: 0
      };
    }
  }
}

export const dataStorage = new DataStorageService();
export default DataStorageService;