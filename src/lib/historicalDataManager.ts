import { blink } from '../blink/client';
import { LinearIssue } from './linearApi';
import { calculateBusinessHours } from './timeUtils';

export interface HistoricalIssue {
  id: string;
  user_id: string;
  issue_id: string;
  identifier: string;
  title: string;
  estimate?: number;
  team_id?: string;
  team_name?: string;
  cycle_id?: string;
  cycle_name?: string;
  cycle_number?: number;
  state_name: string;
  state_type: string;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  started_at?: string;
  lead_time_hours?: string; // Stored as string for SQLite REAL compatibility
  labels: string; // JSON string
  status_history: string; // JSON string
  imported_at: string;
}

class HistoricalDataManager {
  /**
   * Save Linear issues to historical database for comprehensive analysis
   */
  async saveIssuesHistory(userId: string, issues: LinearIssue[]): Promise<void> {
    if (!userId || !Array.isArray(issues) || issues.length === 0) {
      console.warn('Invalid parameters for saveIssuesHistory:', { userId, issuesLength: issues?.length });
      return;
    }

    console.log(`Saving ${issues.length} issues to historical database...`);
    
    const historicalIssues: Omit<HistoricalIssue, 'id'>[] = issues.map(issue => {
      // Calculate lead time if issue is completed
      let leadTimeHours: number | null = null;
      if (issue.completedAt && issue.startedAt) {
        try {
          const startTime = new Date(issue.startedAt);
          const endTime = new Date(issue.completedAt);
          
          // Validate dates
          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            console.warn(`Invalid dates for issue ${issue.identifier}:`, { startedAt: issue.startedAt, completedAt: issue.completedAt });
            leadTimeHours = null;
          } else {
            const calculatedHours = calculateBusinessHours(startTime, endTime);
            // Ensure we have a valid positive number, round to 2 decimal places
            if (isNaN(calculatedHours) || calculatedHours < 0) {
              leadTimeHours = null;
            } else {
              leadTimeHours = Math.round(calculatedHours * 100) / 100;
              // Final validation - ensure it's a finite number
              if (!isFinite(leadTimeHours)) {
                leadTimeHours = null;
              }
            }
          }
        } catch (error) {
          console.warn(`Error calculating lead time for issue ${issue.identifier}:`, error);
          leadTimeHours = null;
        }
      }

      return {
        user_id: userId,
        issue_id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        estimate: issue.estimate || null,
        team_id: issue.team?.id || null,
        team_name: issue.team?.name || null,
        cycle_id: issue.cycle?.id || null,
        cycle_name: issue.cycle?.name || null,
        cycle_number: issue.cycle?.number || null,
        state_name: issue.state.name,
        state_type: issue.state.type,
        assignee_name: issue.assignee?.name || null,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
        completed_at: issue.completedAt || null,
        started_at: issue.startedAt || null,
        lead_time_hours: leadTimeHours,
        labels: JSON.stringify(issue.labels?.nodes || []),
        status_history: JSON.stringify(issue.statusHistory || []),
        imported_at: new Date().toISOString()
      };
    });

    // Process issues in smaller batches with longer delays to avoid rate limiting
    const batchSize = 3; // Reduced batch size to minimize rate limit hits
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let rateLimitRetries = 0;
    const maxRateLimitRetries = 5;

    console.log(`Processing ${historicalIssues.length} issues in batches of ${batchSize}...`);

    for (let i = 0; i < historicalIssues.length; i += batchSize) {
      const batch = historicalIssues.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(historicalIssues.length / batchSize)} (${batch.length} issues)`);
      
      for (const historicalIssue of batch) {
        try {
          // Comprehensive data validation before insertion
          if (!historicalIssue.issue_id || !historicalIssue.identifier || !historicalIssue.title) {
            console.warn(`Skipping invalid issue data:`, historicalIssue.identifier);
            skipCount++;
            continue;
          }

          // Validate required string fields
          if (typeof historicalIssue.issue_id !== 'string' || 
              typeof historicalIssue.identifier !== 'string' || 
              typeof historicalIssue.title !== 'string') {
            console.warn(`Skipping issue with invalid string fields:`, historicalIssue.identifier);
            skipCount++;
            continue;
          }

          // Ensure numeric fields are properly typed and validated
          const sanitizedIssue = {
            ...historicalIssue,
            estimate: historicalIssue.estimate ? Number(historicalIssue.estimate) : null,
            cycle_number: historicalIssue.cycle_number ? Number(historicalIssue.cycle_number) : null,
            // CRITICAL FIX: Convert lead_time_hours to string for database storage
            // The Blink SDK expects REAL fields to be stored as strings in SQLite
            lead_time_hours: historicalIssue.lead_time_hours !== null && historicalIssue.lead_time_hours !== undefined ? 
              (() => {
                const numValue = Number(historicalIssue.lead_time_hours);
                if (isNaN(numValue) || !isFinite(numValue)) {
                  console.warn(`Invalid lead_time_hours for ${historicalIssue.identifier}:`, historicalIssue.lead_time_hours);
                  return null;
                }
                // Round to 2 decimal places and convert to string for SQLite REAL storage
                const roundedValue = Math.round(numValue * 100) / 100;
                return roundedValue.toString();
              })() : null
          };

          // Final validation to ensure lead_time_hours is either null or a valid string representation of a number
          if (sanitizedIssue.lead_time_hours !== null) {
            if (typeof sanitizedIssue.lead_time_hours !== 'string' || isNaN(Number(sanitizedIssue.lead_time_hours)) || !isFinite(Number(sanitizedIssue.lead_time_hours))) {
              console.warn(`Final validation failed for lead_time_hours ${historicalIssue.identifier}:`, sanitizedIssue.lead_time_hours);
              sanitizedIssue.lead_time_hours = null;
            }
          }

          // Validate all string fields to prevent JSON parsing issues
          const stringFields = ['labels', 'status_history'];
          stringFields.forEach(field => {
            if (sanitizedIssue[field] && typeof sanitizedIssue[field] !== 'string') {
              console.warn(`Invalid ${field} for ${historicalIssue.identifier}:`, sanitizedIssue[field]);
              sanitizedIssue[field] = JSON.stringify(sanitizedIssue[field] || []);
            }
          });

          // Ensure all date fields are valid ISO strings
          const dateFields = ['created_at', 'updated_at', 'completed_at', 'started_at', 'imported_at'];
          dateFields.forEach(field => {
            if (sanitizedIssue[field] && sanitizedIssue[field] !== null) {
              try {
                const date = new Date(sanitizedIssue[field]);
                if (isNaN(date.getTime())) {
                  console.warn(`Invalid ${field} for ${historicalIssue.identifier}:`, sanitizedIssue[field]);
                  if (field === 'created_at' || field === 'updated_at' || field === 'imported_at') {
                    // Required fields - use current time as fallback
                    sanitizedIssue[field] = new Date().toISOString();
                  } else {
                    // Optional fields - set to null
                    sanitizedIssue[field] = null;
                  }
                }
              } catch (error) {
                console.warn(`Error validating ${field} for ${historicalIssue.identifier}:`, error);
                if (field === 'created_at' || field === 'updated_at' || field === 'imported_at') {
                  sanitizedIssue[field] = new Date().toISOString();
                } else {
                  sanitizedIssue[field] = null;
                }
              }
            }
          });

          // Final pre-insertion validation
          const finalValidationErrors = [];
          
          // Check all required fields
          if (!sanitizedIssue.user_id) finalValidationErrors.push('user_id is required');
          if (!sanitizedIssue.issue_id) finalValidationErrors.push('issue_id is required');
          if (!sanitizedIssue.identifier) finalValidationErrors.push('identifier is required');
          if (!sanitizedIssue.title) finalValidationErrors.push('title is required');
          if (!sanitizedIssue.created_at) finalValidationErrors.push('created_at is required');
          if (!sanitizedIssue.updated_at) finalValidationErrors.push('updated_at is required');
          if (!sanitizedIssue.imported_at) finalValidationErrors.push('imported_at is required');
          
          // Check numeric fields (stored as strings for SQLite REAL)
          if (sanitizedIssue.lead_time_hours !== null && (typeof sanitizedIssue.lead_time_hours !== 'string' || isNaN(Number(sanitizedIssue.lead_time_hours)))) {
            finalValidationErrors.push(`lead_time_hours must be a valid number string, got: ${sanitizedIssue.lead_time_hours} (${typeof sanitizedIssue.lead_time_hours})`);
          }
          
          if (finalValidationErrors.length > 0) {
            console.warn(`Skipping issue ${historicalIssue.identifier} due to validation errors:`, finalValidationErrors);
            skipCount++;
            continue;
          }

          // Create a unique ID that includes the updated_at timestamp to avoid conflicts
          const uniqueId = `hist_${userId}_${sanitizedIssue.issue_id}_${new Date(sanitizedIssue.updated_at).getTime()}`;

          // Check if this exact record already exists
          const existingIssue = await blink.db.linear_issues_history.list({
            where: {
              user_id: userId,
              issue_id: sanitizedIssue.issue_id,
              updated_at: sanitizedIssue.updated_at
            },
            limit: 1
          });

          if (existingIssue.length === 0) {
            // Create new record with unique ID
            await blink.db.linear_issues_history.create({
              id: uniqueId,
              ...sanitizedIssue
            });
            console.log(`✅ Saved historical issue: ${sanitizedIssue.identifier}`);
            successCount++;
          } else {
            // Record already exists - check if we need to update it
            const existing = existingIssue[0];
            const needsUpdate = 
              existing.title !== sanitizedIssue.title ||
              existing.state_name !== sanitizedIssue.state_name ||
              existing.completed_at !== sanitizedIssue.completed_at ||
              existing.lead_time_hours !== sanitizedIssue.lead_time_hours;

            if (needsUpdate) {
              await blink.db.linear_issues_history.update(existing.id, sanitizedIssue);
              console.log(`🔄 Updated historical issue: ${sanitizedIssue.identifier}`);
              successCount++;
            } else {
              console.log(`⏭️ Skipped unchanged issue: ${sanitizedIssue.identifier}`);
              skipCount++;
            }
          }
        } catch (error: any) {
          // Handle rate limit errors with exponential backoff
          if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED' || error?.message?.includes('Rate limit exceeded')) {
            console.warn(`⏳ Rate limit hit for issue ${historicalIssue.identifier}. Retrying with backoff...`);
            
            if (rateLimitRetries < maxRateLimitRetries) {
              rateLimitRetries++;
              const backoffDelay = Math.min(1000 * Math.pow(2, rateLimitRetries), 60000); // Max 60 seconds
              console.log(`⏳ Waiting ${backoffDelay}ms before retry (attempt ${rateLimitRetries}/${maxRateLimitRetries})`);
              
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              
              // Retry the same issue
              try {
                // Create a unique ID that includes the updated_at timestamp to avoid conflicts
                const uniqueId = `hist_${userId}_${sanitizedIssue.issue_id}_${new Date(sanitizedIssue.updated_at).getTime()}`;

                // Check if this exact record already exists
                const existingIssue = await blink.db.linear_issues_history.list({
                  where: {
                    user_id: userId,
                    issue_id: sanitizedIssue.issue_id,
                    updated_at: sanitizedIssue.updated_at
                  },
                  limit: 1
                });

                if (existingIssue.length === 0) {
                  // Create new record with unique ID
                  await blink.db.linear_issues_history.create({
                    id: uniqueId,
                    ...sanitizedIssue
                  });
                  console.log(`✅ Saved historical issue after retry: ${sanitizedIssue.identifier}`);
                  successCount++;
                } else {
                  // Record already exists - check if we need to update it
                  const existing = existingIssue[0];
                  const needsUpdate = 
                    existing.title !== sanitizedIssue.title ||
                    existing.state_name !== sanitizedIssue.state_name ||
                    existing.completed_at !== sanitizedIssue.completed_at ||
                    existing.lead_time_hours !== sanitizedIssue.lead_time_hours;

                  if (needsUpdate) {
                    await blink.db.linear_issues_history.update(existing.id, sanitizedIssue);
                    console.log(`🔄 Updated historical issue after retry: ${sanitizedIssue.identifier}`);
                    successCount++;
                  } else {
                    console.log(`⏭️ Skipped unchanged issue after retry: ${sanitizedIssue.identifier}`);
                    skipCount++;
                  }
                }
                
                // Reset retry counter on success
                rateLimitRetries = 0;
                
              } catch (retryError: any) {
                console.error(`❌ Retry failed for issue ${historicalIssue.identifier}:`, retryError);
                errorCount++;
                
                // Log the specific data that failed for debugging
                console.error('Failed data after retry:', {
                  issue_id: historicalIssue.issue_id,
                  identifier: historicalIssue.identifier,
                  updated_at: historicalIssue.updated_at,
                  error_message: retryError?.message || 'Unknown retry error'
                });
              }
            } else {
              console.error(`❌ Max rate limit retries exceeded for issue ${historicalIssue.identifier}`);
              errorCount++;
              
              // Log the specific data that failed for debugging
              console.error('Failed data (max retries exceeded):', {
                issue_id: historicalIssue.issue_id,
                identifier: historicalIssue.identifier,
                updated_at: historicalIssue.updated_at,
                error_message: error?.message || 'Rate limit exceeded - max retries reached'
              });
            }
          } else {
            // Handle other types of errors
            errorCount++;
            
            if (error?.status === 409 || error?.message?.includes('UNIQUE constraint failed')) {
              console.warn(`⚠️ Duplicate issue detected (${historicalIssue.identifier}), skipping...`);
              skipCount++;
            } else if (error?.status === 500 && error?.details?.error_details?.includes('JSON parse error')) {
              console.error(`❌ JSON parsing error for issue ${historicalIssue.identifier}:`, {
                error_details: error.details.error_details,
                lead_time_hours: historicalIssue.lead_time_hours,
                lead_time_hours_type: typeof historicalIssue.lead_time_hours
              });
              // Log the specific data that failed for debugging
              console.error('Failed data with JSON parse error:', {
                issue_id: historicalIssue.issue_id,
                identifier: historicalIssue.identifier,
                updated_at: historicalIssue.updated_at,
                lead_time_hours: historicalIssue.lead_time_hours,
                error_message: error?.message || 'JSON parse error'
              });
            } else {
              console.error(`❌ Error saving historical issue ${historicalIssue.identifier}:`, error);
              // Log the specific data that failed for debugging
              console.error('Failed data:', {
                issue_id: historicalIssue.issue_id,
                identifier: historicalIssue.identifier,
                updated_at: historicalIssue.updated_at,
                error_message: error?.message || 'Unknown error'
              });
            }
          }
          // Continue with other issues even if one fails
        }
      }

      // Add longer delay between batches to prevent rate limiting
      if (i + batchSize < historicalIssues.length) {
        const batchDelay = rateLimitRetries > 0 ? 2000 + (rateLimitRetries * 1000) : 500; // Increase delay if we've hit rate limits
        console.log(`⏳ Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
      
      // Circuit breaker: if we've hit too many rate limit errors, pause processing
      if (rateLimitRetries >= maxRateLimitRetries) {
        console.warn(`🚨 Circuit breaker activated: Too many rate limit retries. Pausing for 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        rateLimitRetries = 0; // Reset after circuit breaker pause
      }
    }

    console.log(`📊 Historical data processing complete:`, {
      total: historicalIssues.length,
      success: successCount,
      skipped: skipCount,
      errors: errorCount
    });
  }

  /**
   * Get ALL completed issues with estimates for confidence interval calculations
   */
  async getAllCompletedIssuesWithEstimates(userId: string): Promise<HistoricalIssue[]> {
    try {
      const allIssues = await blink.db.linear_issues_history.list({
        where: {
          user_id: userId,
          state_type: 'completed',
          // Only issues with estimates
          estimate: { gt: 0 }
        },
        orderBy: { completed_at: 'desc' },
        limit: 1000 // Get up to 1000 historical issues
      });

      console.log(`Retrieved ${allIssues.length} completed issues with estimates from historical database`);
      return allIssues;
    } catch (error) {
      console.error('Error retrieving historical issues:', error);
      return [];
    }
  }

  /**
   * Get statistics about historical data
   */
  async getHistoricalDataStats(userId: string): Promise<{
    totalIssues: number;
    completedIssues: number;
    issuesWithEstimates: number;
    uniqueCycles: number;
    uniqueTeams: number;
    dateRange: { earliest: string; latest: string } | null;
  }> {
    try {
      // Get total counts
      const totalIssues = await blink.db.linear_issues_history.list({
        where: { user_id: userId },
        limit: 1
      });

      const completedIssues = await blink.db.linear_issues_history.list({
        where: { 
          user_id: userId,
          state_type: 'completed'
        },
        limit: 1
      });

      const issuesWithEstimates = await blink.db.linear_issues_history.list({
        where: { 
          user_id: userId,
          state_type: 'completed',
          estimate: { gt: 0 }
        },
        limit: 1
      });

      // Get all issues for unique counts and date range
      const allIssues = await blink.db.linear_issues_history.list({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
        limit: 1000
      });

      const uniqueCycles = new Set(allIssues.map(issue => issue.cycle_id).filter(Boolean)).size;
      const uniqueTeams = new Set(allIssues.map(issue => issue.team_id).filter(Boolean)).size;

      let dateRange: { earliest: string; latest: string } | null = null;
      if (allIssues.length > 0) {
        const dates = allIssues.map(issue => new Date(issue.created_at)).sort((a, b) => a.getTime() - b.getTime());
        dateRange = {
          earliest: dates[0].toISOString().split('T')[0],
          latest: dates[dates.length - 1].toISOString().split('T')[0]
        };
      }

      return {
        totalIssues: totalIssues.length,
        completedIssues: completedIssues.length,
        issuesWithEstimates: issuesWithEstimates.length,
        uniqueCycles,
        uniqueTeams,
        dateRange
      };
    } catch (error) {
      console.error('Error getting historical data stats:', error);
      return {
        totalIssues: 0,
        completedIssues: 0,
        issuesWithEstimates: 0,
        uniqueCycles: 0,
        uniqueTeams: 0,
        dateRange: null
      };
    }
  }

  /**
   * Convert historical issues back to LinearIssue format for calculations
   */
  convertToLinearIssues(historicalIssues: HistoricalIssue[]): LinearIssue[] {
    return historicalIssues.map(hist => ({
      id: hist.issue_id,
      identifier: hist.identifier,
      title: hist.title,
      estimate: hist.estimate,
      priority: 1, // Default priority
      state: {
        id: `state_${hist.state_name}`,
        name: hist.state_name,
        type: hist.state_type
      },
      team: {
        id: hist.team_id || 'unknown',
        name: hist.team_name || 'Unknown Team'
      },
      assignee: hist.assignee_name ? {
        id: 'assignee_id',
        name: hist.assignee_name,
        email: 'unknown@example.com'
      } : undefined,
      createdAt: hist.created_at,
      updatedAt: hist.updated_at,
      completedAt: hist.completed_at,
      startedAt: hist.started_at,
      labels: {
        nodes: JSON.parse(hist.labels || '[]')
      },
      cycle: hist.cycle_id ? {
        id: hist.cycle_id,
        name: hist.cycle_name || 'Unknown Cycle',
        number: hist.cycle_number || 0,
        startsAt: hist.created_at, // Fallback
        endsAt: hist.updated_at // Fallback
      } : undefined,
      statusHistory: JSON.parse(hist.status_history || '[]')
    }));
  }

  /**
   * Clean up old historical data (older than specified days)
   */
  async cleanupOldData(userId: string, olderThanDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const oldIssues = await blink.db.linear_issues_history.list({
        where: {
          user_id: userId,
          created_at: { lt: cutoffDate.toISOString() }
        }
      });

      for (const issue of oldIssues) {
        await blink.db.linear_issues_history.delete(issue.id);
      }

      console.log(`Cleaned up ${oldIssues.length} old historical issues`);
      return oldIssues.length;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return 0;
    }
  }
}

export const historicalDataManager = new HistoricalDataManager();