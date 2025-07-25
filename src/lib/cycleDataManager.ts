import { blink } from '../blink/client';
import { LinearIssue, LinearCycle } from './linearApi';
import { DORAMetrics, LeadTimeAnalysis, EstimationAnalysis, CodeReviewAnalysis } from './doraCalculator';

export interface CachedCycleData {
  id: string;
  user_id: string;
  team_id: string | null;
  cycle_id: string | null;
  period: string;
  issues_data: string; // JSON stringified LinearIssue[]
  metrics_data: string; // JSON stringified metrics
  cached_at: string;
  updated_at: string;
}

export interface CycleDataResult {
  issues: LinearIssue[];
  metrics: {
    doraMetrics: DORAMetrics;
    leadTimeAnalysis: LeadTimeAnalysis;
    estimationAnalysis: EstimationAnalysis;
    codeReviewAnalysis: CodeReviewAnalysis;
  };
  fromCache: boolean;
  cachedAt?: string;
}

class CycleDataManager {
  /**
   * Check if data exists in cache for the given parameters
   */
  async hasDataInCache(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<boolean> {
    try {
      const cached = await blink.db.cycle_data_cache.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        limit: 1
      });

      return cached.length > 0;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Get cached data for the given parameters
   */
  async getCachedData(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<CycleDataResult | null> {
    try {
      console.log('🔍 Getting cached data for:', { userId, teamId, cycleId, period });
      
      // First try exact match
      let cached = await blink.db.cycle_data_cache.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        limit: 1
      });

      console.log('🔍 Exact match query result:', { 
        foundEntries: cached.length,
        entryIds: cached.map(c => c.id)
      });

      // If no exact match, try to find any cached data for this team/cycle combination
      if (cached.length === 0) {
        console.log('🔍 No exact match found, trying fallback query...');
        cached = await blink.db.cycle_data_cache.list({
          where: {
            user_id: userId,
            team_id: teamId,
            cycle_id: cycleId
          },
          orderBy: { cached_at: 'desc' },
          limit: 1
        });

        console.log('🔍 Fallback query result:', { 
          foundEntries: cached.length,
          entryIds: cached.map(c => c.id),
          periods: cached.map(c => c.period)
        });

        if (cached.length > 0) {
          console.log(`⚠️ Using cached data from period "${cached[0].period}" instead of requested period "${period}"`);
        }
      }

      if (cached.length === 0) {
        console.log('❌ No cached entries found even with fallback');
        return null;
      }

      const cacheEntry = cached[0];
      console.log('🔍 Cache entry details:', {
        id: cacheEntry.id,
        cached_at: cacheEntry.cached_at,
        issues_data_length: cacheEntry.issues_data?.length || 0,
        metrics_data_length: cacheEntry.metrics_data?.length || 0
      });
      
      // Parse the cached data with error handling
      let issues: LinearIssue[] = [];
      let metrics: any = {};

      try {
        const issuesDataString = cacheEntry.issues_data || '[]';
        console.log('🔍 Parsing issues_data string length:', issuesDataString.length);
        issues = JSON.parse(issuesDataString) as LinearIssue[];
        console.log('✅ Parsed issues successfully:', issues.length, 'issues');
        
        // Validate that issues is actually an array
        if (!Array.isArray(issues)) {
          console.warn('⚠️ Parsed issues is not an array, converting to array');
          issues = [];
        }
      } catch (issuesError) {
        console.error('❌ Error parsing issues_data:', issuesError);
        console.error('❌ Raw issues_data preview:', cacheEntry.issues_data?.substring(0, 200) + '...');
        issues = [];
      }

      try {
        const metricsDataString = cacheEntry.metrics_data || '{}';
        console.log('🔍 Parsing metrics_data string length:', metricsDataString.length);
        metrics = JSON.parse(metricsDataString);
        console.log('✅ Parsed metrics successfully:', Object.keys(metrics));
        
        // Validate that metrics is actually an object
        if (!metrics || typeof metrics !== 'object') {
          console.warn('⚠️ Parsed metrics is not an object, using empty object');
          metrics = {};
        }
      } catch (metricsError) {
        console.error('❌ Error parsing metrics_data:', metricsError);
        console.error('❌ Raw metrics_data preview:', cacheEntry.metrics_data?.substring(0, 200) + '...');
        metrics = {};
      }

      const result = {
        issues,
        metrics,
        fromCache: true,
        cachedAt: cacheEntry.cached_at
      };

      console.log('✅ Returning cached data result:', {
        issuesCount: result.issues.length,
        metricsKeys: Object.keys(result.metrics),
        fromCache: result.fromCache,
        cachedAt: result.cachedAt
      });

      return result;
    } catch (error) {
      console.error('❌ Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Save data to cache
   */
  async saveToCache(
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
  ): Promise<void> {
    try {
      const cacheId = `cache_${userId}_${teamId || 'all'}_${cycleId || 'all'}_${period}_${Date.now()}`;
      const now = new Date().toISOString();

      // Check if entry already exists
      const existing = await blink.db.cycle_data_cache.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        limit: 1
      });

      const cacheData = {
        user_id: userId,
        team_id: teamId,
        cycle_id: cycleId,
        period,
        issues_data: JSON.stringify(issues),
        metrics_data: JSON.stringify(metrics),
        cached_at: now,
        updated_at: now
      };

      if (existing.length > 0) {
        // Update existing entry
        await blink.db.cycle_data_cache.update(existing[0].id, cacheData);
        console.log('✅ Updated cached data for cycle');
      } else {
        // Create new entry
        await blink.db.cycle_data_cache.create({
          id: cacheId,
          ...cacheData
        });
        console.log('✅ Saved new cached data for cycle');
      }
    } catch (error) {
      console.error('Error saving to cache:', error);
      throw error;
    }
  }

  /**
   * Get cache info for display to user
   */
  async getCacheInfo(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<{
    hasCache: boolean;
    cachedAt?: string;
    issueCount?: number;
  }> {
    try {
      // First try exact match
      let cached = await blink.db.cycle_data_cache.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        limit: 1
      });

      // If no exact match, try fallback
      if (cached.length === 0) {
        cached = await blink.db.cycle_data_cache.list({
          where: {
            user_id: userId,
            team_id: teamId,
            cycle_id: cycleId
          },
          orderBy: { cached_at: 'desc' },
          limit: 1
        });
      }

      if (cached.length === 0) {
        return { hasCache: false };
      }

      const cacheEntry = cached[0];
      const issues = JSON.parse(cacheEntry.issues_data || '[]') as LinearIssue[];

      return {
        hasCache: true,
        cachedAt: cacheEntry.cached_at,
        issueCount: issues.length
      };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { hasCache: false };
    }
  }

  /**
   * Clear cache for specific parameters
   */
  async clearCache(
    userId: string,
    teamId: string | null,
    cycleId: string | null,
    period: string
  ): Promise<void> {
    try {
      const cached = await blink.db.cycle_data_cache.list({
        where: {
          user_id: userId,
          team_id: teamId,
          cycle_id: cycleId,
          period
        },
        limit: 1
      });

      if (cached.length > 0) {
        await blink.db.cycle_data_cache.delete(cached[0].id);
        console.log('✅ Cleared cache for cycle');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get all cached cycles for a user
   */
  async getUserCachedCycles(userId: string): Promise<Array<{
    teamId: string | null;
    cycleId: string | null;
    period: string;
    cachedAt: string;
    issueCount: number;
  }>> {
    try {
      const cached = await blink.db.cycle_data_cache.list({
        where: { user_id: userId },
        orderBy: { cached_at: 'desc' },
        limit: 100
      });

      return cached.map(entry => {
        const issues = JSON.parse(entry.issues_data || '[]') as LinearIssue[];
        return {
          teamId: entry.team_id,
          cycleId: entry.cycle_id,
          period: entry.period,
          cachedAt: entry.cached_at,
          issueCount: issues.length
        };
      });
    } catch (error) {
      console.error('Error getting user cached cycles:', error);
      return [];
    }
  }

  /**
   * Clean up old cache entries
   */
  async cleanupOldCache(userId: string, keepDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const oldEntries = await blink.db.cycle_data_cache.list({
        where: { user_id: userId },
        orderBy: { cached_at: 'asc' },
        limit: 1000
      });

      const entriesToDelete = oldEntries.filter(entry => 
        new Date(entry.cached_at) < cutoffDate
      );

      let deletedCount = 0;
      for (const entry of entriesToDelete) {
        try {
          await blink.db.cycle_data_cache.delete(entry.id);
          deletedCount++;
        } catch (error) {
          console.warn('Error deleting cache entry:', entry.id, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old cache:', error);
      return 0;
    }
  }
}

export const cycleDataManager = new CycleDataManager();
export default CycleDataManager;