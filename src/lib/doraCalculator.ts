import { LinearIssue, LinearCycle } from './linearApi';
import { calculateBusinessHours, formatBusinessDuration } from './timeUtils';

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
  };
  timeToRecovery: {
    value: number;
    unit: string;
    formattedValue?: string;
    trend: number;
    rating: 'Elite' | 'High' | 'Medium' | 'Low';
  };
}

export interface LeadTimeAnalysis {
  byEstimate: Array<{
    estimate: number;
    averageLeadTime: number;
    count: number;
    accuracy: number;
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
  }>;
  velocityTrends: Array<{
    period: string;
    planned: number;
    actual: number;
    accuracy: number;
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

  constructor(issues: LinearIssue[], selectedCycle?: LinearCycle) {
    this.issues = issues;
    this.selectedCycle = selectedCycle;
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

  private getLeadTimeInHours(issue: LinearIssue): number {
    // Lead time should be from "in progress" (startedAt) to "deployed" (completedAt)
    // Only calculate for issues that have both timestamps and an estimate
    if (!issue.completedAt || !issue.startedAt || !issue.estimate || issue.estimate <= 0) {
      return 0;
    }
    
    const started = new Date(issue.startedAt);
    const completed = new Date(issue.completedAt);
    
    // Use business hours calculation (excludes weekends)
    return calculateBusinessHours(started, completed);
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
    const cycleMap = new Map<string, LinearIssue[]>();
    
    // Group issues by completion date (day)
    issues.forEach(issue => {
      if (issue.completedAt) {
        const date = issue.completedAt.split('T')[0]; // Get YYYY-MM-DD
        if (!cycleMap.has(date)) {
          cycleMap.set(date, []);
        }
        cycleMap.get(date)!.push(issue);
      }
    });

    // Convert to deployment cycles
    return Array.from(cycleMap.entries()).map(([date, cycleIssues]) => {
      // A cycle is considered failed if it contains any bugs, hotfixes, or incidents
      const isFailedDeployment = cycleIssues.some(issue =>
        issue.labels.nodes.some(label => 
          label.name.toLowerCase().includes('bug') ||
          label.name.toLowerCase().includes('hotfix') ||
          label.name.toLowerCase().includes('incident') ||
          label.name.toLowerCase().includes('revert')
        )
      );

      return {
        date,
        issues: cycleIssues,
        isFailedDeployment
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get issues that have the "incident" label and calculate recovery time
   * Recovery time = from when incident tag was applied to when deployed (completedAt)
   */
  private getIncidentRecoveryTimes(issues: LinearIssue[]): number[] {
    const incidentIssues = issues.filter(issue => 
      issue.completedAt &&
      issue.state.type === 'completed' &&
      issue.labels.nodes.some(label => 
        label.name.toLowerCase().includes('incident')
      )
    );

    return incidentIssues.map(issue => {
      if (!issue.completedAt || !issue.createdAt) return 0;
      
      // For now, we'll use createdAt as proxy for when incident tag was applied
      // In a real implementation, you'd want to track when the incident label was actually added
      const incidentStart = new Date(issue.createdAt);
      const resolved = new Date(issue.completedAt);
      
      // Use business hours calculation (excludes weekends)
      return calculateBusinessHours(incidentStart, resolved);
    }).filter(time => time > 0);
  }

  calculateDORAMetrics(): DORAMetrics {
    const completedIssues = this.getCompletedIssues();
    const recentIssues = this.getIssuesInPeriod(30); // Last 30 days
    const previousPeriodIssues = this.getIssuesInPeriod(60).filter(issue => {
      const completedDate = new Date(issue.completedAt!);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      return completedDate >= sixtyDaysAgo && completedDate < thirtyDaysAgo;
    });

    // Get deployment cycles for both recent and previous periods (needed for multiple calculations)
    const recentCycles = this.getDeploymentCycles(recentIssues);
    const previousCycles = this.getDeploymentCycles(previousPeriodIssues);

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
    const previousDeploymentFreq = this.selectedCycle ? 
      previousCycles.reduce((sum, cycle) => sum + cycle.issues.length, 0) : 
      previousCycles.length / 30;
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
    const previousIssuesWithEstimates = previousPeriodIssues.filter(issue => 
      issue.completedAt && 
      issue.state.type === 'completed' &&
      issue.estimate && 
      issue.estimate > 0
    );
    const previousLeadTimes = previousIssuesWithEstimates.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
    const previousAvgLeadTime = previousLeadTimes.length > 0 
      ? previousLeadTimes.reduce((sum, time) => sum + time, 0) / previousLeadTimes.length 
      : 0;
    const leadTimeTrend = previousAvgLeadTime > 0 
      ? Math.round(((averageLeadTimeHours - previousAvgLeadTime) / previousAvgLeadTime) * 100)
      : 0;

    // 3. Change Failure Rate - Percentage of deployment cycles that failed
    const failedCycles = recentCycles.filter(cycle => cycle.isFailedDeployment);
    const changeFailureRate = recentCycles.length > 0 
      ? (failedCycles.length / recentCycles.length) * 100 
      : 0;

    const previousFailedCycles = previousCycles.filter(cycle => cycle.isFailedDeployment);
    const previousFailureRate = previousCycles.length > 0 
      ? (previousFailedCycles.length / previousCycles.length) * 100 
      : 0;
    const failureRateTrend = previousFailureRate > 0 
      ? Math.round(((changeFailureRate - previousFailureRate) / previousFailureRate) * 100)
      : 0;

    // 4. Time to Recovery - Only for issues with "incident" label
    const recentRecoveryTimes = this.getIncidentRecoveryTimes(recentIssues);
    const averageRecoveryTimeHours = recentRecoveryTimes.length > 0
      ? recentRecoveryTimes.reduce((sum, time) => sum + time, 0) / recentRecoveryTimes.length
      : 0;
    const averageRecoveryTimeDays = this.getLeadTimeInDays(averageRecoveryTimeHours);

    const previousRecoveryTimes = this.getIncidentRecoveryTimes(previousPeriodIssues);
    const previousAvgRecovery = previousRecoveryTimes.length > 0
      ? previousRecoveryTimes.reduce((sum, time) => sum + time, 0) / previousRecoveryTimes.length
      : 0;
    const recoveryTrend = previousAvgRecovery > 0 
      ? Math.round(((averageRecoveryTimeHours - previousAvgRecovery) / previousAvgRecovery) * 100)
      : 0;

    return {
      deploymentFrequency: {
        value: this.selectedCycle ? deploymentFrequency : Math.round(deploymentFrequency * 10) / 10,
        unit: deploymentUnit,
        displayText: deploymentDisplayText || undefined,
        trend: deploymentTrend,
        rating: this.getRating(deploymentFrequency, [1, 0.2, 0.1]) // Elite: >1/day, High: >1/5days, Medium: >1/10days
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
        rating: this.getRating(changeFailureRate, [15, 30, 45], true) // Elite: <15%, High: <30%, Medium: <45%
      },
      timeToRecovery: {
        value: averageRecoveryTimeDays,
        unit: 'business days',
        formattedValue: formatBusinessDuration(averageRecoveryTimeHours),
        trend: -recoveryTrend, // Negative because lower is better
        rating: this.getRating(averageRecoveryTimeDays, [0.04, 1, 7], true) // Elite: <1hour, High: <1day, Medium: <1week
      }
    };
  }

  calculateLeadTimeAnalysis(): LeadTimeAnalysis {
    const completedIssuesWithEstimates = this.getCompletedIssuesWithEstimates();
    
    // Lead time by estimate - only for issues with estimates
    const estimateGroups = [1, 2, 3, 5, 8];
    const byEstimate = estimateGroups.map(estimate => {
      const issuesWithEstimate = completedIssuesWithEstimates.filter(issue => issue.estimate === estimate);
      const leadTimes = issuesWithEstimate.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      const averageLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
        : 0;
      
      // Calculate accuracy based on how close actual lead time is to a reasonable expectation
      // Assuming 1 story point = 8 hours of work (1 day), lead time should be close to this
      const expectedHours = estimate * 8; // 8 hours per story point (1 working day)
      
      // Accuracy is based on how close the actual lead time is to expected
      // We consider anything within 50% of expected as good accuracy
      let accuracy = 0;
      if (averageLeadTime > 0 && expectedHours > 0) {
        const deviation = Math.abs(averageLeadTime - expectedHours) / expectedHours;
        // If deviation is 0, accuracy is 100%. If deviation is 1 (100% off), accuracy is 0%
        accuracy = Math.max(0, Math.min(100, (1 - deviation) * 100));
      }

      return {
        estimate,
        averageLeadTime: Math.round(averageLeadTime),
        count: issuesWithEstimate.length,
        accuracy: Math.round(accuracy)
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
    const completedIssuesWithEstimates = this.getCompletedIssuesWithEstimates();
    
    // Accuracy by estimate - only for issues with estimates
    const estimateGroups = [1, 2, 3, 5, 8];
    const accuracyByEstimate = estimateGroups.map(estimate => {
      const issuesWithEstimate = completedIssuesWithEstimates.filter(issue => issue.estimate === estimate);
      const leadTimes = issuesWithEstimate.map(issue => this.getLeadTimeInHours(issue)).filter(time => time > 0);
      const averageActual = leadTimes.length > 0 
        ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
        : 0;
      
      // Expected time: 1 story point = 8 hours (1 working day)
      const expectedHours = estimate * 8;
      
      // Calculate accuracy based on how close actual is to expected
      let accuracy = 0;
      if (averageActual > 0 && expectedHours > 0) {
        const deviation = Math.abs(averageActual - expectedHours) / expectedHours;
        // If deviation is 0, accuracy is 100%. If deviation is 1 (100% off), accuracy is 0%
        accuracy = Math.max(0, Math.min(100, (1 - deviation) * 100));
      }

      return {
        estimate,
        accuracy: Math.round(accuracy),
        count: issuesWithEstimate.length,
        averageActual: Math.round(averageActual)
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

    return Array.from(weeks.entries())
      .map(([weekStart, weekIssues]) => {
        const planned = weekIssues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
        const actual = weekIssues.reduce((sum, issue) => sum + (issue.estimate || 1), 0); // Use estimate as actual points delivered
        const accuracy = planned > 0 ? Math.round((Math.min(actual, planned) / planned) * 100) : 0;

        return {
          period: weekStart,
          planned,
          actual,
          accuracy
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8); // Last 8 weeks
  }

  calculateCodeReviewAnalysis(): CodeReviewAnalysis {
    // Since we don't have access to historyEntries, we'll estimate code review time
    // based on available timestamps and state information
    const codeReviewStates = ['Code Review', 'In Review', 'Review', 'PR Review', 'Reviewing'];
    const mergedStates = ['Merged', 'Done', 'Completed', 'Deployed', 'Released'];

    const reviewTasks: CodeReviewTask[] = [];

    // Process each completed issue to estimate code review time
    this.issues.forEach(issue => {
      // Only process completed issues that have both startedAt and completedAt
      if (!issue.completedAt || !issue.startedAt || !issue.state) return;

      // Check if the issue is in a state that suggests it went through code review
      const isInReviewState = codeReviewStates.some(state => 
        issue.state.name.toLowerCase().includes(state.toLowerCase())
      );
      const isInMergedState = mergedStates.some(state => 
        issue.state.name.toLowerCase().includes(state.toLowerCase())
      );

      // For completed issues, estimate that code review took place in the last 25% of the lead time
      if (isInMergedState || issue.state.type === 'completed') {
        const started = new Date(issue.startedAt);
        const completed = new Date(issue.completedAt);
        const totalLeadTime = calculateBusinessHours(started, completed);

        if (totalLeadTime > 0) {
          // Estimate that code review took 25% of the total lead time
          // This is a rough approximation since we don't have actual history
          const estimatedReviewTime = totalLeadTime * 0.25;
          
          // Estimate review started 25% before completion
          const reviewStartTime = new Date(completed.getTime() - (totalLeadTime * 0.25 * 60 * 60 * 1000));

          reviewTasks.push({
            issueId: issue.identifier,
            title: issue.title,
            estimate: issue.estimate,
            timeInReview: estimatedReviewTime,
            reviewStartedAt: reviewStartTime.toISOString(),
            mergedAt: issue.completedAt
          });
        }
      }
    });

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