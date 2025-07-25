import { LinearIssue, LinearCycle } from './linearApi';
import { calculateBusinessHours, formatBusinessDuration } from './timeUtils';
import { 
  calculateStatisticalSummary, 
  calculateAccuracyWithConfidence, 
  ConfidenceInterval, 
  PredictiveRange,
  StatisticalSummary 
} from './statisticsUtils';
import { historicalDataManager, HistoricalIssue } from './historicalDataManager';

export interface DORAMetrics {
  deploymentFrequency: {
    value: number;
    unit: string;
    displayText?: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
  };
  leadTimeForChanges: {
    value: number;
    unit: string;
    formattedValue?: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
  };
  changeFailureRate: {
    value: number;
    unit: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
    details?: {
      totalDeployments: number;
      failedDeployments: number;
      failureDescription: string;
    };
  };
  timeToRecovery: {
    value: number;
    unit: string;
    formattedValue?: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
  };
  timeToDeploy: {
    value: number;
    unit: string;
    formattedValue?: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
    details?: {
      totalDeployments: number;
      averageDeployTime: number;
      deploymentDescription: string;
    };
  };
}

export interface LeadTimeAnalysis {
  byEstimate: Array<{
    estimate: number;
    averageLeadTime: number;
    count: number;
    accuracy: number;
    confidenceInterval: ConfidenceInterval;
    predictiveRange: PredictiveRange;
    statisticalSummary: StatisticalSummary;
  }>;
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  trends: Array<{
    date: string;
    leadTime: number;
  }>;
}

export interface EstimationAnalysis {
  accuracyByEstimate: Array<{
    estimate: number;
    accuracy: number;
    count: number;
    averageActual: number;
    confidenceInterval: ConfidenceInterval;
    predictiveRange: PredictiveRange;
    statisticalSummary: StatisticalSummary;
  }>;
  velocityTrends: Array<{
    period: string;
    planned: number;
    actual: number;
    accuracy: number;
    confidenceInterval: ConfidenceInterval;
  }>;
  bottlenecks: Array<{
    issueId: string;
    title: string;
    estimate: number;
    actualTime: number;
    overrun: number;
    assignee?: string;
  }>;
}

export interface CodeReviewTask {
  issueId: string;
  title: string;
  estimate?: number;
  timeInReview: number; // in hours
  reviewStartedAt: string;
  mergedAt: string;
}

export interface CodeReviewAnalysis {
  averageTimeInReview: {
    value: number; // in hours
    formattedValue: string;
    unit: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
  };
  tasks: CodeReviewTask[];
  byEstimate: Array<{
    estimate: number;
    averageReviewTime: number;
    count: number;
  }>;
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

interface DeploymentCycle {
  date: string;
  issues: LinearIssue[];
  isFailedDeployment: boolean;
}

class DORACalculator {
  private issues: LinearIssue[];
  private selectedCycle?: LinearCycle;
  private allCycles: LinearCycle[];
  private userId?: string;
  private historicalIssues: LinearIssue[] = [];

  constructor(issues: LinearIssue[], selectedCycle?: LinearCycle, allCycles: LinearCycle[] = [], userId?: string) {
    this.issues = issues;
    this.selectedCycle = selectedCycle;
    this.allCycles = allCycles;
    this.userId = userId;
  }

  /**
   * Load historical data for comprehensive confidence interval calculations
   */
  async loadHistoricalData(): Promise<void> {
    if (!this.userId) {
      console.warn('No user ID provided, using only current cycle data for confidence intervals');
      return;
    }

    try {
      const historicalData = await historicalDataManager.getAllCompletedIssuesWithEstimates(this.userId);
      this.historicalIssues = historicalDataManager.convertToLinearIssues(historicalData);
      console.log(`Loaded ${this.historicalIssues.length} historical issues for confidence interval calculations`);
    } catch (error) {
      console.error('Error loading historical data:', error);
      this.historicalIssues = [];
    }
  }

  private getCompletedIssues(): LinearIssue[] {
    return this.issues.filter(issue => 
      issue.completedAt && 
      issue.state.type === 'completed'
    );
  }

  private getCompletedIssuesWithEstimates(): LinearIssue[] {
    return this.issues.filter(issue => 
      issue.completedAt && 
      issue.state.type === 'completed' &&
      issue.estimate && 
      issue.estimate > 0
    );
  }

  /**
   * Get ALL completed issues with estimates for confidence interval calculations
   * This includes both current cycle issues AND historical data
   */
  private getAllCompletedIssuesWithEstimates(): LinearIssue[] {
    // Combine current cycle issues with historical issues
    const currentIssues = this.getCompletedIssuesWithEstimates();
    
    // If we have historical data, combine it with current issues
    if (this.historicalIssues.length > 0) {
      // Remove duplicates by issue ID to avoid double-counting
      const currentIssueIds = new Set(currentIssues.map(issue => issue.id));
      const uniqueHistoricalIssues = this.historicalIssues.filter(issue => !currentIssueIds.has(issue.id));
      
      const combinedIssues = [...currentIssues, ...uniqueHistoricalIssues];
      console.log(`Using ${combinedIssues.length} total issues for confidence intervals (${currentIssues.length} current + ${uniqueHistoricalIssues.length} historical)`);
      return combinedIssues;
    }
    
    // Fallback to current issues only if no historical data
    console.log(`Using ${currentIssues.length} current cycle issues for confidence intervals (no historical data available)`);
    return currentIssues;
  }

  private getLeadTimeInHours(issue: LinearIssue): number {
    // Lead time for changes should be from "code review" (when code is committed) to "deployed" (completedAt)
    // This follows DORA metric definition: time from commit to production deployment
    if (!issue.completedAt || !issue.estimate || issue.estimate <= 0) {
      return 0;
    }
    
    let codeReviewStartTime: string | null = null;
    
    // First, try to find the actual "Code Review" transition in status history
    if (issue.statusHistory && Array.isArray(issue.statusHistory)) {
      const codeReviewTransition = issue.statusHistory.find(entry => {
        if (!entry || !entry.toState) return false;
        const state = entry.toState.toLowerCase().trim();
        return state === 'code review' || 
               state === 'in review' || 
               state === 'review' || 
               state === 'pr review' ||
               state === 'reviewing';
      });
      
      if (codeReviewTransition && codeReviewTransition.timestamp) {
        codeReviewStartTime = codeReviewTransition.timestamp;
      }
    }
    
    // Fallback: if no code review transition found, use startedAt as proxy for when development began
    // This is less accurate but better than no data
    if (!codeReviewStartTime && issue.startedAt) {
      codeReviewStartTime = issue.startedAt;
    }
    
    if (!codeReviewStartTime) {
      return 0;
    }
    
    const codeReviewStart = new Date(codeReviewStartTime);
    const deployed = new Date(issue.completedAt);
    
    // Validate timestamps
    if (isNaN(codeReviewStart.getTime()) || isNaN(deployed.getTime())) {
      return 0;
    }
    
    // Ensure deployment is after code review start
    if (deployed <= codeReviewStart) {
      return 0;
    }
    
    // Use business hours calculation (excludes weekends)
    return calculateBusinessHours(codeReviewStart, deployed);
  }

  private getLeadTimeInDays(businessHours: number): number {
    // Convert business hours to business days (8 hours per business day)
    return Math.round((businessHours / 8) * 10) / 10;
  }

  private getRating(value: number, thresholds: number[], reverse = false): 'Elite' | 'High' | 'Medium' | 'Low' {
    if (reverse) {
      // For metrics where lower is better (lead time, recovery time, failure rate)
      if (value <= thresholds[0]) return 'Elite';
      if (value <= thresholds[1]) return 'High';
      if (value <= thresholds[2]) return 'Medium';
      return 'Low';
    } else {
      // For metrics where higher is better (deployment frequency)
      if (value >= thresholds[0]) return 'Elite';
      if (value >= thresholds[1]) return 'High';
      if (value >= thresholds[2]) return 'Medium';
      return 'Low';
    }
  }

  private getIssuesInPeriod(days: number): LinearIssue[] {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return this.issues.filter(issue => {
      if (!issue.completedAt) return false;
      const completedDate = new Date(issue.completedAt);
      return completedDate >= periodStart && completedDate <= now;
    });
  }

  /**
   * Group completed issues into deployment cycles based on completion date
   * Each day with completed issues represents a deployment cycle
   */
  private getDeploymentCycles(issues: LinearIssue[]): DeploymentCycle[] {
    if (!issues || !Array.isArray(issues)) {
      return [];
    }

    const cycleMap = new Map<string, LinearIssue[]>();
    
    // Group issues by completion date (day)
    issues.forEach(issue => {
      if (issue && issue.completedAt && typeof issue.completedAt === 'string') {
        try {
          const date = issue.completedAt.split('T')[0]; // Get YYYY-MM-DD
          if (date && date.length === 10) { // Basic validation for YYYY-MM-DD format
            if (!cycleMap.has(date)) {
              cycleMap.set(date, []);
            }
            cycleMap.get(date)!.push(issue);
          }
        } catch (error) {
          console.warn('Error processing issue completion date:', issue.completedAt, error);
        }
      }
    });

    // Convert to deployment cycles
    return Array.from(cycleMap.entries()).map(([date, cycleIssues]) => {
      // A cycle is considered failed if it contains any bugs, hotfixes, or incidents
      let isFailedDeployment = false;
      try {
        isFailedDeployment = cycleIssues.some(issue =>
          issue && issue.labels && issue.labels.nodes && Array.isArray(issue.labels.nodes) &&
          issue.labels.nodes.some(label => 
            label && label.name && typeof label.name === 'string' &&
            (label.name.toLowerCase().includes('bug') ||
             label.name.toLowerCase().includes('hotfix') ||
             label.name.toLowerCase().includes('incident') ||
             label.name.toLowerCase().includes('revert'))
          )
        );
      } catch (error) {
        console.warn('Error checking for failed deployment labels:', error);
        isFailedDeployment = false;
      }

      return {
        date,
        issues: cycleIssues || [],
        isFailedDeployment
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate time to deploy for issues that have been merged and deployed
   * Time to deploy = from when code is merged to when it's deployed
   * ONLY calculates for issues that have BOTH "Merged" and "Deployed" status transitions
   */
  private getTimeToDeployHours(issue: LinearIssue): number {
    if (!issue.completedAt || !issue.state || issue.state.type !== 'completed') {
      return 0;
    }
    
    let mergedTime: string | null = null;
    let deployedTime: string | null = null;
    
    // Look for EXACT "Merged" and "Deployed" transitions in status history
    if (issue.statusHistory && Array.isArray(issue.statusHistory)) {
      // Find the transition TO "Merged" state (exact match)
      const mergedTransition = issue.statusHistory.find(entry => {
        if (!entry || !entry.toState) return false;
        return entry.toState === 'Merged';
      });
      
      // Find the transition TO "Deployed" state (exact match)
      const deployedTransition = issue.statusHistory.find(entry => {
        if (!entry || !entry.toState) return false;
        return entry.toState === 'Deployed';
      });
      
      if (mergedTransition && mergedTransition.timestamp) {
        mergedTime = mergedTransition.timestamp;
      }
      
      if (deployedTransition && deployedTransition.timestamp) {
        deployedTime = deployedTransition.timestamp;
      }
    }
    
    // ONLY calculate Time to Deploy for issues that have BOTH Merged and Deployed states
    // If either is missing, return 0 (this issue doesn't have the required workflow)
    if (!mergedTime || !deployedTime) {
      return 0;
    }
    
    const merged = new Date(mergedTime);
    const deployed = new Date(deployedTime);
    
    // Validate timestamps
    if (isNaN(merged.getTime()) || isNaN(deployed.getTime())) {
      return 0;
    }
    
    // Ensure deployment is after merge
    if (deployed <= merged) {
      return 0;
    }
    
    // Use business hours calculation (excludes weekends)
    const deployTime = calculateBusinessHours(merged, deployed);
    
    return deployTime;
  }

  /**
   * Get issues that have the "incident" label and calculate recovery time
   * Recovery time = from when incident tag was applied to when deployed (completedAt)
   */
  private getIncidentRecoveryTimes(issues: LinearIssue[]): number[] {
    if (!issues || !Array.isArray(issues)) {
      return [];
    }

    const incidentIssues = issues.filter(issue => 
      issue && 
      issue.completedAt &&
      issue.state && issue.state.type === 'completed' &&
      issue.labels && issue.labels.nodes && Array.isArray(issue.labels.nodes) &&
      issue.labels.nodes.some(label => 
        label && label.name && typeof label.name === 'string' &&
        label.name.toLowerCase().includes('incident')
      )
    );

    return incidentIssues.map(issue => {
      if (!issue.completedAt || !issue.createdAt) return 0;
      
      try {
        // For now, we'll use createdAt as proxy for when incident tag was applied
        // In a real implementation, you'd want to track when the incident label was actually added
        const incidentStart = new Date(issue.createdAt);
        const resolved = new Date(issue.completedAt);
        
        // Use business hours calculation (excludes weekends)
        return calculateBusinessHours(incidentStart, resolved);
      } catch (error) {
        console.warn('Error calculating recovery time for issue:', issue.identifier, error);
        return 0;
      }
    }).filter(time => time > 0);
  }

  calculateDORAMetrics(): DORAMetrics {
    try {
      const completedIssues = this.getCompletedIssues();
      const recentIssues = this.getIssuesInPeriod(30); // Last 30 days
      const previousPeriodIssues = this.getIssuesInPeriod(60).filter(issue => {
        if (!issue || !issue.completedAt) return false;
        try {
          const completedDate = new Date(issue.completedAt);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
          return completedDate >= sixtyDaysAgo && completedDate < thirtyDaysAgo;
        } catch (error) {
          console.warn('Error filtering previous period issues:', error);
          return false;
        }
      });

      // Get deployment cycles for both recent and previous periods (needed for multiple calculations)
      // Ensure these variables are properly declared and accessible throughout the method
      let recentCycles: DeploymentCycle[] = [];
      let previousCycles: DeploymentCycle[] = [];
      
      try {
        recentCycles = this.getDeploymentCycles(recentIssues);
        previousCycles = this.getDeploymentCycles(previousPeriodIssues);
      } catch (error) {
        console.error('Error calculating deployment cycles:', error);
        // Fallback to empty arrays if there's an error
        recentCycles = [];
        previousCycles = [];
      }

    // 1. Deployment Frequency - Count tasks that reached "Deployed" state within the selected cycle
    let deploymentFrequency = 0;
    let deploymentDisplayText = '';
    let deploymentUnit = 'deployments';
    
    if (this.selectedCycle) {
      // Cycle-based frequency: count issues that reached "Deployed" status within the cycle timeframe
      const cycleStart = new Date(this.selectedCycle.startsAt);
      const cycleEnd = new Date(this.selectedCycle.endsAt);
      
      const deployedInCycle = this.issues.filter(issue => {
        if (!issue.completedAt || issue.state.type !== 'completed') return false;
        
        const completedDate = new Date(issue.completedAt);
        return completedDate >= cycleStart && completedDate <= cycleEnd;
      });
      
      deploymentFrequency = deployedInCycle.length;
      deploymentDisplayText = `${deploymentFrequency} deployments in Cycle #${this.selectedCycle.number}`;
      deploymentUnit = `in Cycle #${this.selectedCycle.number}`;
    } else {
      // Fallback to original logic when no specific cycle is selected
      deploymentFrequency = recentCycles.length / 30; // cycles per day
      deploymentUnit = 'cycles/day';
    }
    
    // Calculate trend (compare with previous period)
    let previousDeploymentFreq = 0;
    if (this.selectedCycle) {
      // For cycle-based comparison, we need to compare with the previous cycle
      const currentCycleIndex = this.allCycles.findIndex(c => c.id === this.selectedCycle!.id);
      if (currentCycleIndex > 0 && currentCycleIndex < this.allCycles.length) {
        // Get the previous cycle (cycles are sorted by most recent first)
        const previousCycle = this.allCycles[currentCycleIndex + 1];
        if (previousCycle) {
          // Count issues completed in the previous cycle
          const prevCycleStart = new Date(previousCycle.startsAt);
          const prevCycleEnd = new Date(previousCycle.endsAt);
          
          const deployedInPrevCycle = this.issues.filter(issue => {
            if (!issue.completedAt || issue.state.type !== 'completed') return false;
            
            const completedDate = new Date(issue.completedAt);
            return completedDate >= prevCycleStart && completedDate <= prevCycleEnd;
          });
          
          previousDeploymentFreq = deployedInPrevCycle.length;
        }
      }
    } else {
      // Original logic for time-based periods
      previousDeploymentFreq = previousCycles && previousCycles.length > 0 ? previousCycles.length / 30 : 0;
    }
    
    const deploymentTrend = previousDeploymentFreq > 0 
      ? Math.round(((deploymentFrequency - previousDeploymentFreq) / previousDeploymentFreq) * 100)
      : 0;

    // 2. Lead Time for Changes - Average lead time across all cycles
    const completedIssuesWithEstimates = this.getCompletedIssuesWithEstimates();
    const recentIssuesWithEstimates = completedIssuesWithEstimates.filter(issue => {
      const completedDate = new Date(issue.completedAt!);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return completedDate >= thirtyDaysAgo;
    });

    const leadTimes = recentIssuesWithEstimates.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
    const averageLeadTimeHours = leadTimes.length > 0 
      ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
      : 0;
    const averageLeadTimeDays = this.getLeadTimeInDays(averageLeadTimeHours);

    // Calculate previous period lead time for trend
    let previousAvgLeadTime = 0;
    if (this.selectedCycle) {
      // For cycle-based comparison, compare with previous cycle
      const currentCycleIndex = this.allCycles.findIndex(c => c.id === this.selectedCycle!.id);
      if (currentCycleIndex > 0 && currentCycleIndex < this.allCycles.length) {
        const previousCycle = this.allCycles[currentCycleIndex + 1];
        if (previousCycle) {
          const prevCycleStart = new Date(previousCycle.startsAt);
          const prevCycleEnd = new Date(previousCycle.endsAt);
          
          const prevCycleIssuesWithEstimates = this.issues.filter(issue => {
            if (!issue.completedAt || issue.state.type !== 'completed' || !issue.estimate || issue.estimate <= 0) return false;
            const completedDate = new Date(issue.completedAt);
            return completedDate >= prevCycleStart && completedDate <= prevCycleEnd;
          });
          
          const prevLeadTimes = prevCycleIssuesWithEstimates.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
          previousAvgLeadTime = prevLeadTimes.length > 0 
            ? prevLeadTimes.reduce((sum, time) => sum + time, 0) / prevLeadTimes.length 
            : 0;
        }
      }
    } else {
      // Original logic for time-based periods
      const previousIssuesWithEstimates = previousPeriodIssues.filter(issue => 
        issue.completedAt && 
        issue.state.type === 'completed' &&
        issue.estimate && 
        issue.estimate > 0
      );
      const previousLeadTimes = previousIssuesWithEstimates.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      previousAvgLeadTime = previousLeadTimes.length > 0 
        ? previousLeadTimes.reduce((sum, time) => sum + time, 0) / previousLeadTimes.length 
        : 0;
    }
    
    const leadTimeTrend = previousAvgLeadTime > 0 
      ? Math.round(((averageLeadTimeHours - previousAvgLeadTime) / previousAvgLeadTime) * 100)
      : 0;

    // 3. Change Failure Rate - Percentage of deployed tasks that resulted in failures
    // Base Set: All tasks that reached "Deployed" status
    const deployedTasks = recentIssues.filter(issue => 
      issue.state.name.toLowerCase().includes('deployed') ||
      issue.state.type === 'completed' // Also consider completed as deployed
    );

    // Failure Identification: Tasks with "Incident" or "Rollback" tags
    const failedDeployments = deployedTasks.filter(issue =>
      issue.labels.nodes.some(label => 
        label.name.toLowerCase().includes('incident') ||
        label.name.toLowerCase().includes('rollback')
      )
    );

    const changeFailureRate = deployedTasks.length > 0 
      ? (failedDeployments.length / deployedTasks.length) * 100 
      : 0;

    // Calculate previous period for trend
    let previousFailureRate = 0;
    if (this.selectedCycle) {
      // For cycle-based comparison, compare with previous cycle
      const currentCycleIndex = this.allCycles.findIndex(c => c.id === this.selectedCycle!.id);
      if (currentCycleIndex > 0 && currentCycleIndex < this.allCycles.length) {
        const previousCycle = this.allCycles[currentCycleIndex + 1];
        if (previousCycle) {
          const prevCycleStart = new Date(previousCycle.startsAt);
          const prevCycleEnd = new Date(previousCycle.endsAt);
          
          const prevDeployedTasks = this.issues.filter(issue => {
            if (!issue.completedAt || issue.state.type !== 'completed') return false;
            const completedDate = new Date(issue.completedAt);
            return completedDate >= prevCycleStart && completedDate <= prevCycleEnd;
          });
          
          const prevFailedDeployments = prevDeployedTasks.filter(issue =>
            issue.labels.nodes.some(label => 
              label.name.toLowerCase().includes('incident') ||
              label.name.toLowerCase().includes('rollback')
            )
          );
          
          previousFailureRate = prevDeployedTasks.length > 0 
            ? (prevFailedDeployments.length / prevDeployedTasks.length) * 100 
            : 0;
        }
      }
    } else {
      // Original logic for time-based periods
      const previousDeployedTasks = previousPeriodIssues.filter(issue => 
        issue.state.name.toLowerCase().includes('deployed') ||
        issue.state.type === 'completed'
      );
      const previousFailedDeployments = previousDeployedTasks.filter(issue =>
        issue.labels.nodes.some(label => 
          label.name.toLowerCase().includes('incident') ||
          label.name.toLowerCase().includes('rollback')
        )
      );
      previousFailureRate = previousDeployedTasks.length > 0 
        ? (previousFailedDeployments.length / previousDeployedTasks.length) * 100 
        : 0;
    }
    
    const failureRateTrend = previousFailureRate > 0 
      ? Math.round(((changeFailureRate - previousFailureRate) / previousFailureRate) * 100)
      : 0;

    // 4. Time to Recovery - Only for issues with "incident" label
    const recentRecoveryTimes = this.getIncidentRecoveryTimes(recentIssues);
    const averageRecoveryTimeHours = recentRecoveryTimes.length > 0
      ? recentRecoveryTimes.reduce((sum, time) => sum + time, 0) / recentRecoveryTimes.length
      : 0;
    const averageRecoveryTimeDays = this.getLeadTimeInDays(averageRecoveryTimeHours);

    let previousAvgRecovery = 0;
    if (this.selectedCycle) {
      // For cycle-based comparison, compare with previous cycle
      const currentCycleIndex = this.allCycles.findIndex(c => c.id === this.selectedCycle!.id);
      if (currentCycleIndex > 0 && currentCycleIndex < this.allCycles.length) {
        const previousCycle = this.allCycles[currentCycleIndex + 1];
        if (previousCycle) {
          const prevCycleStart = new Date(previousCycle.startsAt);
          const prevCycleEnd = new Date(previousCycle.endsAt);
          
          const prevCycleIncidentIssues = this.issues.filter(issue => {
            if (!issue.completedAt || issue.state.type !== 'completed') return false;
            const completedDate = new Date(issue.completedAt);
            const inCycle = completedDate >= prevCycleStart && completedDate <= prevCycleEnd;
            const hasIncidentLabel = issue.labels && issue.labels.nodes && Array.isArray(issue.labels.nodes) &&
              issue.labels.nodes.some(label => 
                label && label.name && typeof label.name === 'string' &&
                label.name.toLowerCase().includes('incident')
              );
            return inCycle && hasIncidentLabel;
          });
          
          const prevRecoveryTimes = this.getIncidentRecoveryTimes(prevCycleIncidentIssues);
          previousAvgRecovery = prevRecoveryTimes.length > 0
            ? prevRecoveryTimes.reduce((sum, time) => sum + time, 0) / prevRecoveryTimes.length
            : 0;
        }
      }
    } else {
      // Original logic for time-based periods
      const previousRecoveryTimes = this.getIncidentRecoveryTimes(previousPeriodIssues);
      previousAvgRecovery = previousRecoveryTimes.length > 0
        ? previousRecoveryTimes.reduce((sum, time) => sum + time, 0) / previousRecoveryTimes.length
        : 0;
    }
    
    const recoveryTrend = previousAvgRecovery > 0 
      ? Math.round(((averageRecoveryTimeHours - previousAvgRecovery) / previousAvgRecovery) * 100)
      : 0;

    // 5. Time to Deploy - Time from merged to deployed for all completed issues
    const recentCompletedIssues = this.getCompletedIssues().filter(issue => {
      const completedDate = new Date(issue.completedAt!);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return completedDate >= thirtyDaysAgo;
    });

    const deployTimes = recentCompletedIssues.map(issue => this.getTimeToDeployHours(issue)).filter(time => time > 0);
    const averageDeployTimeHours = deployTimes.length > 0
      ? deployTimes.reduce((sum, time) => sum + time, 0) / deployTimes.length
      : 0;
    const averageDeployTimeDays = this.getLeadTimeInDays(averageDeployTimeHours);

    // Calculate previous period for trend
    let previousAvgDeployTime = 0;
    if (this.selectedCycle) {
      // For cycle-based comparison, compare with previous cycle
      const currentCycleIndex = this.allCycles.findIndex(c => c.id === this.selectedCycle!.id);
      if (currentCycleIndex > 0 && currentCycleIndex < this.allCycles.length) {
        const previousCycle = this.allCycles[currentCycleIndex + 1];
        if (previousCycle) {
          const prevCycleStart = new Date(previousCycle.startsAt);
          const prevCycleEnd = new Date(previousCycle.endsAt);
          
          const prevCycleCompletedIssues = this.issues.filter(issue => {
            if (!issue.completedAt || issue.state.type !== 'completed') return false;
            const completedDate = new Date(issue.completedAt);
            return completedDate >= prevCycleStart && completedDate <= prevCycleEnd;
          });
          
          const prevDeployTimes = prevCycleCompletedIssues.map(issue => this.getTimeToDeployHours(issue)).filter(time => time > 0);
          previousAvgDeployTime = prevDeployTimes.length > 0
            ? prevDeployTimes.reduce((sum, time) => sum + time, 0) / prevDeployTimes.length
            : 0;
        }
      }
    } else {
      // Original logic for time-based periods
      const previousCompletedIssues = previousPeriodIssues.filter(issue => 
        issue.completedAt && issue.state.type === 'completed'
      );
      const previousDeployTimes = previousCompletedIssues.map(issue => this.getTimeToDeployHours(issue)).filter(time => time > 0);
      previousAvgDeployTime = previousDeployTimes.length > 0
        ? previousDeployTimes.reduce((sum, time) => sum + time, 0) / previousDeployTimes.length
        : 0;
    }
    
    const deployTimeTrend = previousAvgDeployTime > 0 
      ? Math.round(((averageDeployTimeHours - previousAvgDeployTime) / previousAvgDeployTime) * 100)
      : 0;

      return {
        deploymentFrequency: {
          value: this.selectedCycle ? deploymentFrequency : Math.round(deploymentFrequency * 10) / 10,
          unit: deploymentUnit,
          displayText: deploymentDisplayText || undefined,
          trend: deploymentTrend,
          rating: this.selectedCycle 
            ? this.getRating(deploymentFrequency, [10, 5, 1]) // For cycle-based: Elite: >10, High: >5, Medium: >1 deployments per cycle
            : this.getRating(deploymentFrequency, [1, 0.2, 0.1]) // For daily rate: Elite: >1/day, High: >1/5days, Medium: >1/10days
        },
        leadTimeForChanges: {
          value: averageLeadTimeDays,
          unit: 'business days',
          formattedValue: formatBusinessDuration(averageLeadTimeHours),
          trend: -leadTimeTrend, // Negative because lower is better
          rating: this.getRating(averageLeadTimeDays, [1, 7, 30], true) // Elite: <1day, High: <1week, Medium: <1month
        },
        changeFailureRate: {
          value: Math.round(changeFailureRate * 10) / 10,
          unit: '%',
          trend: -failureRateTrend, // Negative because lower is better
          rating: this.getRating(changeFailureRate, [15, 30, 45], true), // Elite: <15%, High: <30%, Medium: <45%
          details: {
            totalDeployments: deployedTasks.length,
            failedDeployments: failedDeployments.length,
            failureDescription: deployedTasks.length === 0 
              ? 'No deployments found in the selected period'
              : `${failedDeployments.length} out of ${deployedTasks.length} deployments marked as failures (tags: Incident/Rollback)`
          }
        },
        timeToRecovery: {
          value: averageRecoveryTimeDays,
          unit: 'business days',
          formattedValue: formatBusinessDuration(averageRecoveryTimeHours),
          trend: -recoveryTrend, // Negative because lower is better
          rating: this.getRating(averageRecoveryTimeDays, [0.04, 1, 7], true) // Elite: <1hour, High: <1day, Medium: <1week
        },
        timeToDeploy: {
          value: averageDeployTimeDays,
          unit: 'business days',
          formattedValue: formatBusinessDuration(averageDeployTimeHours),
          trend: -deployTimeTrend, // Negative because lower is better
          rating: this.getRating(averageDeployTimeDays, [0.125, 0.5, 2], true), // Elite: <1hour, High: <4hours, Medium: <2days
          details: {
            totalDeployments: recentCompletedIssues.length,
            averageDeployTime: Math.round(averageDeployTimeHours * 10) / 10,
            deploymentDescription: recentCompletedIssues.length === 0 
              ? 'No deployments found in the selected period'
              : `${deployTimes.length} out of ${recentCompletedIssues.length} completed issues had measurable deployment times`
          }
        }
      };
    } catch (error) {
      console.error('Error calculating DORA metrics:', error);
      // Return default metrics in case of error
      return {
        deploymentFrequency: {
          value: 0,
          unit: 'deployments',
          trend: 0,
          rating: 'Low'
        },
        leadTimeForChanges: {
          value: 0,
          unit: 'business days',
          formattedValue: '0 hours',
          trend: 0,
          rating: 'Low'
        },
        changeFailureRate: {
          value: 0,
          unit: '%',
          trend: 0,
          rating: 'Elite',
          details: {
            totalDeployments: 0,
            failedDeployments: 0,
            failureDescription: 'Error calculating metrics'
          }
        },
        timeToRecovery: {
          value: 0,
          unit: 'business days',
          formattedValue: '0 hours',
          trend: 0,
          rating: 'Low'
        },
        timeToDeploy: {
          value: 0,
          unit: 'business days',
          formattedValue: '0 hours',
          trend: 0,
          rating: 'Low',
          details: {
            totalDeployments: 0,
            averageDeployTime: 0,
            deploymentDescription: 'Error calculating metrics'
          }
        }
      };
    }
  }

  calculateLeadTimeAnalysis(): LeadTimeAnalysis {
    const completedIssuesWithEstimates = this.getAllCompletedIssuesWithEstimates();
    
    // Lead time by estimate - only for issues with estimates
    const estimateGroups = [1, 2, 3, 5, 8];
    const byEstimate = estimateGroups.map(estimate => {
      const issuesWithEstimate = completedIssuesWithEstimates.filter(issue => issue.estimate === estimate);
      const leadTimes = issuesWithEstimate.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      const averageLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
        : 0;
      
      // Calculate statistical summary with confidence intervals
      const statisticalSummary = calculateStatisticalSummary(leadTimes, 95);
      
      // Calculate accuracy based on how close actual lead time is to a reasonable expectation
      // Assuming 1 story point = 8 hours of work (1 day), lead time should be close to this
      const expectedHours = estimate * 8; // 8 hours per story point (1 working day)
      const expectedValues = leadTimes.map(() => expectedHours);
      
      // Calculate accuracy with confidence interval
      const accuracyWithConfidence = calculateAccuracyWithConfidence(leadTimes, expectedValues, 95);

      return {
        estimate,
        averageLeadTime: Math.round(averageLeadTime),
        count: issuesWithEstimate.length,
        accuracy: accuracyWithConfidence.accuracy,
        confidenceInterval: accuracyWithConfidence.confidenceInterval,
        predictiveRange: statisticalSummary.predictiveRange,
        statisticalSummary
      };
    });

    // Lead time distribution - only for issues with estimates
    const allLeadTimes = completedIssuesWithEstimates.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
    const ranges = [
      { min: 0, max: 8, label: '< 1 day' },
      { min: 8, max: 40, label: '1-5 days' },
      { min: 40, max: 168, label: '5 days - 1 week' },
      { min: 168, max: 336, label: '1-2 weeks' },
      { min: 336, max: Infinity, label: '> 2 weeks' }
    ];

    const distribution = ranges.map(range => {
      const count = allLeadTimes.filter(time => time >= range.min && time < range.max).length;
      return {
        range: range.label,
        count,
        percentage: allLeadTimes.length > 0 ? Math.round((count / allLeadTimes.length) * 100) : 0
      };
    });

    // Trends over time (last 30 days) - only for issues with estimates
    const trends = this.calculateTrends(completedIssuesWithEstimates);

    return {
      byEstimate,
      distribution,
      trends
    };
  }

  calculateEstimationAnalysis(): EstimationAnalysis {
    const completedIssuesWithEstimates = this.getAllCompletedIssuesWithEstimates();
    
    // Accuracy by estimate - only for issues with estimates
    const estimateGroups = [1, 2, 3, 5, 8];
    const accuracyByEstimate = estimateGroups.map(estimate => {
      const issuesWithEstimate = completedIssuesWithEstimates.filter(issue => issue.estimate === estimate);
      const leadTimes = issuesWithEstimate.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      const averageActual = leadTimes.length > 0 
        ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
        : 0;
      
      // Calculate statistical summary with confidence intervals
      const statisticalSummary = calculateStatisticalSummary(leadTimes, 95);
      
      // Expected time: 1 story point = 8 hours (1 working day)
      const expectedHours = estimate * 8;
      const expectedValues = leadTimes.map(() => expectedHours);
      
      // Calculate accuracy with confidence interval
      const accuracyWithConfidence = calculateAccuracyWithConfidence(leadTimes, expectedValues, 95);

      return {
        estimate,
        accuracy: accuracyWithConfidence.accuracy,
        count: issuesWithEstimate.length,
        averageActual: Math.round(averageActual),
        confidenceInterval: accuracyWithConfidence.confidenceInterval,
        predictiveRange: statisticalSummary.predictiveRange,
        statisticalSummary
      };
    });

    // Velocity trends (weekly) - only for issues with estimates
    const velocityTrends = this.calculateVelocityTrends(completedIssuesWithEstimates);

    // Bottlenecks (issues that took significantly longer than estimated)
    const bottlenecks = completedIssuesWithEstimates
      .map(issue => {
        const actualTime = this.getLeadTimeInHours(issue);
        const expectedTime = issue.estimate! * 8; // 8 hours per story point
        const overrun = expectedTime > 0 && actualTime > 0 ? ((actualTime - expectedTime) / expectedTime) * 100 : 0;
        
        return {
          issueId: issue.identifier,
          title: issue.title,
          estimate: issue.estimate!,
          actualTime: Math.round(actualTime),
          overrun: Math.round(overrun),
          assignee: issue.assignee?.name
        };
      })
      .filter(item => item.actualTime > 0 && item.overrun > 50) // More than 50% overrun
      .sort((a, b) => b.overrun - a.overrun)
      .slice(0, 10); // Top 10 bottlenecks

    return {
      accuracyByEstimate,
      velocityTrends,
      bottlenecks
    };
  }

  private calculateTrends(issues: LinearIssue[]): Array<{ date: string; leadTime: number }> {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayIssues = issues.filter(issue => 
        issue.completedAt && issue.completedAt.startsWith(date)
      );
      
      const leadTimes = dayIssues.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      const averageLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
        : 0;

      return {
        date,
        leadTime: Math.round(averageLeadTime)
      };
    });
  }

  private calculateVelocityTrends(issues: LinearIssue[]): Array<{
    period: string;
    planned: number;
    actual: number;
    accuracy: number;
    confidenceInterval: ConfidenceInterval;
  }> {
    // Group issues by week
    const weeks = new Map<string, LinearIssue[]>();
    
    issues.forEach(issue => {
      if (issue.completedAt) {
        const date = new Date(issue.completedAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, []);
        }
        weeks.get(weekKey)!.push(issue);
      }
    });

    const weeklyData = Array.from(weeks.entries())
      .map(([weekStart, weekIssues]) => {
        const planned = weekIssues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
        const actual = weekIssues.reduce((sum, issue) => sum + (issue.estimate || 1), 0); // Use estimate as actual points delivered
        const accuracy = planned > 0 ? (Math.min(actual, planned) / planned) * 100 : 0;

        return {
          period: weekStart,
          planned,
          actual,
          accuracy
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8); // Last 8 weeks

    // Calculate confidence interval for accuracy across weeks
    const accuracyValues = weeklyData.map(week => week.accuracy);
    const accuracyStats = calculateStatisticalSummary(accuracyValues, 95);

    return weeklyData.map(week => ({
      ...week,
      accuracy: Math.round(week.accuracy),
      confidenceInterval: accuracyStats.confidenceInterval
    }));
  }

  /**
   * Calculate code review analysis using flexible detection methods
   * 
   * This method uses multiple approaches to detect code reviews:
   * 1. Status history transitions (primary method)
   * 2. Fallback estimation based on issue completion (when status history is incomplete)
   * 3. Assumes most completed issues went through some form of review
   */
  calculateCodeReviewAnalysis(): CodeReviewAnalysis {
    const reviewTasks: CodeReviewTask[] = [];
    const debugInfo = {
      totalIssues: this.issues.length,
      completedIssues: 0,
      withStatusHistory: 0,
      foundCodeReview: 0,
      foundMerged: 0,
      validReviewTasks: 0,
      fallbackTasks: 0
    };

    // Process each issue that is completed
    this.issues.forEach(issue => {
      try {
        // Only process completed issues
        if (!issue.completedAt || !issue.state || issue.state.type !== 'completed') return;
        debugInfo.completedIssues++;

        let codeReviewStartTime: string | null = null;
        let mergedTime: string | null = null;
        let isFromStatusHistory = false;

        // Method 1: Try to find actual status transitions
        if (issue.statusHistory && Array.isArray(issue.statusHistory)) {
          debugInfo.withStatusHistory++;

          // Look for the transition TO "Code Review" state (expanded matching)
          const codeReviewTransition = issue.statusHistory.find(entry => {
            if (!entry || !entry.toState) return false;
            const state = entry.toState.toLowerCase().trim();
            return state === 'code review' || 
                   state === 'in review' || 
                   state === 'review' || 
                   state === 'pr review' ||
                   state === 'reviewing' ||
                   state === 'ready for review' ||
                   state === 'pending review' ||
                   state === 'under review';
          });
          
          // Look for the transition TO "Merged" or final completion state (expanded matching)
          const mergedTransition = issue.statusHistory.find(entry => {
            if (!entry || !entry.toState) return false;
            const state = entry.toState.toLowerCase().trim();
            return state === 'merged' || 
                   state === 'deployed' ||
                   state === 'completed' ||
                   state === 'done' ||
                   state === 'released' ||
                   state === 'closed' ||
                   state === 'finished';
          });

          if (codeReviewTransition) debugInfo.foundCodeReview++;
          if (mergedTransition) debugInfo.foundMerged++;

          // If we found both transitions, use them
          if (codeReviewTransition && mergedTransition && 
              codeReviewTransition.timestamp && mergedTransition.timestamp) {
            codeReviewStartTime = codeReviewTransition.timestamp;
            mergedTime = mergedTransition.timestamp;
            isFromStatusHistory = true;
          }
        }

        // Method 2: Fallback estimation for issues without clear status history
        if (!codeReviewStartTime || !mergedTime) {
          // Assume code review happened in the latter part of the development cycle
          // Use a reasonable estimation: review started 25% before completion
          if (issue.startedAt && issue.completedAt) {
            const startTime = new Date(issue.startedAt);
            const endTime = new Date(issue.completedAt);
            const totalDuration = endTime.getTime() - startTime.getTime();
            
            // Assume code review started 75% through the development cycle
            const reviewStartOffset = totalDuration * 0.75;
            const estimatedReviewStart = new Date(startTime.getTime() + reviewStartOffset);
            
            codeReviewStartTime = estimatedReviewStart.toISOString();
            mergedTime = issue.completedAt;
            debugInfo.fallbackTasks++;
          } else if (issue.completedAt) {
            // Last resort: assume a standard review time of 1-2 days before completion
            const endTime = new Date(issue.completedAt);
            const estimatedReviewStart = new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // 1 day before
            
            codeReviewStartTime = estimatedReviewStart.toISOString();
            mergedTime = issue.completedAt;
            debugInfo.fallbackTasks++;
          }
        }

        // Calculate review time if we have both timestamps
        if (codeReviewStartTime && mergedTime) {
          const reviewStart = new Date(codeReviewStartTime);
          const reviewEnd = new Date(mergedTime);
          
          // Validate timestamps
          if (isNaN(reviewStart.getTime()) || isNaN(reviewEnd.getTime())) {
            console.warn(`Invalid timestamps for issue ${issue.identifier}:`, codeReviewStartTime, mergedTime);
            return;
          }
          
          // Ensure review end is after review start
          if (reviewEnd <= reviewStart) {
            // For fallback cases, use a minimum review time of 2 hours
            if (!isFromStatusHistory) {
              const actualReviewTime = 2; // 2 hours minimum
              reviewTasks.push({
                issueId: issue.identifier,
                title: issue.title,
                estimate: issue.estimate,
                timeInReview: actualReviewTime,
                reviewStartedAt: codeReviewStartTime,
                mergedAt: mergedTime
              });
              debugInfo.validReviewTasks++;
            }
            return;
          }
          
          // Calculate actual time in review using business hours
          const actualReviewTime = calculateBusinessHours(reviewStart, reviewEnd);
          
          if (actualReviewTime > 0) {
            reviewTasks.push({
              issueId: issue.identifier,
              title: issue.title,
              estimate: issue.estimate,
              timeInReview: actualReviewTime,
              reviewStartedAt: codeReviewStartTime,
              mergedAt: mergedTime
            });
            debugInfo.validReviewTasks++;
          }
        }
      } catch (error) {
        console.warn(`Error processing code review data for issue ${issue.identifier}:`, error);
      }
    });

    // Log debug information
    console.log('🔍 Code Review Analysis Debug Info:', debugInfo);
    console.log(`📊 Found ${reviewTasks.length} code review tasks from ${debugInfo.completedIssues} completed issues`);

    // Calculate average time in review
    const totalReviewTime = reviewTasks.reduce((sum, task) => sum + task.timeInReview, 0);
    const averageReviewTimeHours = reviewTasks.length > 0 ? totalReviewTime / reviewTasks.length : 0;

    // Calculate trend (compare with previous period)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentTasks = reviewTasks.filter(task => 
      new Date(task.mergedAt) >= thirtyDaysAgo
    );
    const previousTasks = reviewTasks.filter(task => {
      const mergedDate = new Date(task.mergedAt);
      return mergedDate >= sixtyDaysAgo && mergedDate < thirtyDaysAgo;
    });

    const recentAverage = recentTasks.length > 0 
      ? recentTasks.reduce((sum, task) => sum + task.timeInReview, 0) / recentTasks.length 
      : 0;
    const previousAverage = previousTasks.length > 0 
      ? previousTasks.reduce((sum, task) => sum + task.timeInReview, 0) / previousTasks.length 
      : 0;

    const trend = previousAverage > 0 
      ? Math.round(((recentAverage - previousAverage) / previousAverage) * 100)
      : 0;

    // Calculate rating based on review time
    const getRating = (hours: number): 'Elite' | 'High' | 'Medium' | 'Low' => {
      if (hours <= 4) return 'Elite';    // < 4 hours
      if (hours <= 24) return 'High';    // < 1 day
      if (hours <= 72) return 'Medium';  // < 3 days
      return 'Low';                      // > 3 days
    };

    // Group by estimate
    const estimateGroups = [1, 2, 3, 5, 8];
    const byEstimate = estimateGroups.map(estimate => {
      const tasksWithEstimate = reviewTasks.filter(task => task.estimate === estimate);
      const averageReviewTime = tasksWithEstimate.length > 0
        ? tasksWithEstimate.reduce((sum, task) => sum + task.timeInReview, 0) / tasksWithEstimate.length
        : 0;

      return {
        estimate,
        averageReviewTime: Math.round(averageReviewTime * 10) / 10,
        count: tasksWithEstimate.length
      };
    });

    // Distribution by time ranges
    const ranges = [
      { min: 0, max: 4, label: '< 4 hours' },
      { min: 4, max: 24, label: '4-24 hours' },
      { min: 24, max: 72, label: '1-3 days' },
      { min: 72, max: 168, label: '3-7 days' },
      { min: 168, max: Infinity, label: '> 1 week' }
    ];

    const distribution = ranges.map(range => {
      const count = reviewTasks.filter(task => 
        task.timeInReview >= range.min && task.timeInReview < range.max
      ).length;
      
      return {
        range: range.label,
        count,
        percentage: reviewTasks.length > 0 ? Math.round((count / reviewTasks.length) * 100) : 0
      };
    });

    return {
      averageTimeInReview: {
        value: Math.round(averageReviewTimeHours * 10) / 10,
        formattedValue: formatBusinessDuration(averageReviewTimeHours),
        unit: 'hours',
        trend: -trend, // Negative because lower is better
        rating: getRating(averageReviewTimeHours)
      },
      tasks: reviewTasks.sort((a, b) => b.timeInReview - a.timeInReview), // Sort by review time descending
      byEstimate,
      distribution
    };
  }
}

export default DORACalculator;