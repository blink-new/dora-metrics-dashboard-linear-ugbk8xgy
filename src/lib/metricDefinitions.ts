export interface MetricDefinition {
  title: string;
  formula: string;
  description: string;
  calculation: string;
  includedStatuses: string[];
  excludedCases: string[];
  filteringScope: string;
  thresholds: {
    elite: string;
    high: string;
    medium: string;
    low: string;
  };
  notes?: string[];
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  deploymentFrequency: {
    title: "Deployment Frequency",
    formula: "Number of tasks moved to 'Deployed' status ÷ Time period",
    description: "Measures how often your team deploys code to production. Higher frequency indicates better continuous delivery practices.",
    calculation: "Counts all issues that reach 'Deployed' or 'Completed' state within the selected cycle or time period.",
    includedStatuses: ["Deployed", "Completed", "Done", "Released"],
    excludedCases: ["Issues still in progress", "Cancelled issues", "Issues not marked as deployed"],
    filteringScope: "Only considers issues within the selected cycle or time period (7/30/90 days)",
    thresholds: {
      elite: "Multiple deployments per day (>1/day)",
      high: "Between once per day and once per week (>1/week)",
      medium: "Between once per week and once per month (>1/month)",
      low: "Fewer than once per month (<1/month)"
    },
    notes: [
      "For cycle-based analysis, shows total deployments within the selected cycle",
      "For time-based analysis, shows average deployments per day"
    ]
  },
  
  leadTimeForChanges: {
    title: "Lead Time for Changes",
    formula: "Average time from 'Code Review' (when code is committed) to 'Deployed' (completedAt)",
    description: "Time from when code is committed (enters code review) to when it's successfully running in production. This follows the DORA metric definition measuring deployment pipeline efficiency.",
    calculation: "Calculates business hours from when issue enters 'Code Review' state to 'Deployed'/'Completed' state, then converts to business days (8 hours = 1 business day). Uses Linear status history to find actual code review transition timestamp.",
    includedStatuses: ["Issues with code review transition in status history", "Issues with completedAt timestamps", "Issues with story point estimates"],
    excludedCases: ["Issues without code review state transition", "Issues without estimates", "Issues not completed", "Issues with invalid timestamps"],
    filteringScope: "Only includes issues completed within the selected cycle or time period",
    thresholds: {
      elite: "Less than one day (<1 business day)",
      high: "Between one day and one week (1-7 business days)",
      medium: "Between one week and one month (7-30 business days)",
      low: "More than one month (>30 business days)"
    },
    notes: [
      "Uses Linear status history to find actual 'Code Review' state transition",
      "Fallback to startedAt if no code review transition found",
      "Uses business hours calculation (excludes weekends)",
      "Only calculated for issues with story point estimates",
      "Assumes 8 business hours = 1 business day",
      "Follows DORA standard: commit timestamp to deployment timestamp"
    ]
  },
  
  changeFailureRate: {
    title: "Change Failure Rate",
    formula: "(Failed deployments ÷ Total deployments) × 100",
    description: "Percentage of deployments that result in degraded service requiring immediate remedy. Lower failure rate indicates better quality.",
    calculation: "Identifies failed deployments by checking for 'Incident', 'Rollback', 'Bug', 'Hotfix', or 'Revert' labels on deployed issues.",
    includedStatuses: ["All deployed/completed issues within the time period"],
    excludedCases: ["Issues not yet deployed", "Issues without failure indicators"],
    filteringScope: "Analyzes all deployments within the selected cycle or time period",
    thresholds: {
      elite: "0-15% failure rate",
      high: "16-30% failure rate", 
      medium: "31-45% failure rate",
      low: "More than 45% failure rate"
    },
    notes: [
      "Failure detection based on issue labels: 'incident', 'rollback', 'bug', 'hotfix', 'revert'",
      "Case-insensitive label matching",
      "Each deployment cycle (day) with any failed issues counts as a failed deployment"
    ]
  },
  
  timeToRecovery: {
    title: "Time to Recovery",
    formula: "Average time from incident detection (createdAt) to resolution (completedAt)",
    description: "Time to restore service when a failure occurs in production. Lower recovery time indicates better incident response.",
    calculation: "Calculates business hours between createdAt and completedAt for issues labeled as 'Incident'.",
    includedStatuses: ["Issues with 'Incident' label", "Issues with both createdAt and completedAt timestamps"],
    excludedCases: ["Issues without incident labels", "Unresolved incidents", "Issues without proper timestamps"],
    filteringScope: "Only includes incident issues resolved within the selected cycle or time period",
    thresholds: {
      elite: "Less than one hour (<0.04 business days)",
      high: "Less than one day (<1 business day)",
      medium: "Less than one week (<7 business days)",
      low: "More than one week (>7 business days)"
    },
    notes: [
      "Uses createdAt as proxy for incident detection time",
      "In production systems, you'd track when the incident label was actually applied",
      "Uses business hours calculation (excludes weekends)"
    ]
  },
  
  timeToDeploy: {
    title: "Time to Deploy",
    formula: "Average time from 'Merged' status to 'Deployed' (completedAt)",
    description: "Time from when code is merged to when it's deployed in production. This measures the efficiency of your automatic deployment system and CI/CD pipeline.",
    calculation: "Calculates business hours from when issue reaches 'Merged' state to 'Deployed'/'Completed' state. Uses Linear status history to find actual merge transition timestamp, with fallbacks to review completion or estimated merge time.",
    includedStatuses: ["Issues with merge transition in status history", "Issues with completedAt timestamps", "All completed issues"],
    excludedCases: ["Issues not completed", "Issues with invalid timestamps", "Issues where deployment occurred before merge"],
    filteringScope: "Includes all completed issues within the selected cycle or time period",
    thresholds: {
      elite: "Less than 1 hour (<0.125 business days)",
      high: "1-4 hours (0.125-0.5 business days)",
      medium: "4 hours to 2 days (0.5-2 business days)",
      low: "More than 2 days (>2 business days)"
    },
    notes: [
      "Uses Linear status history to find actual 'Merged' state transition",
      "Fallback to 'Review Complete', 'Approved', or 'Ready' states if no merge found",
      "Final fallback estimates merge time as 4 hours before deployment",
      "Uses business hours calculation (excludes weekends)",
      "Measures deployment pipeline efficiency and automation speed",
      "Lower times indicate better CI/CD automation and deployment practices"
    ]
  },
  
  codeReviewTime: {
    title: "Average Time in Code Review",
    formula: "Average time from code review start to merge/completion",
    description: "Time spent in code review process before code is merged. Lower review time indicates efficient review processes.",
    calculation: "Uses Linear status history to track actual transitions from 'Code Review' state to 'Merged'/'Completed' state, calculating precise review duration.",
    includedStatuses: ["Issues with status history", "Issues that transitioned through 'Code Review' state", "Issues that reached 'Merged'/'Completed' state"],
    excludedCases: ["Issues without status history", "Issues that bypassed code review", "Issues with invalid timestamps"],
    filteringScope: "Analyzes all issues with code review transitions within the selected time period",
    thresholds: {
      elite: "Less than 4 hours",
      high: "4-24 hours (same day)",
      medium: "1-3 days",
      low: "More than 3 days"
    },
    notes: [
      "Uses actual Linear status history data for precise calculation",
      "Tracks transitions from states like 'Code Review', 'In Review', 'PR Review' to 'Merged', 'Deployed', 'Completed'",
      "Calculates business hours between review start and merge timestamps",
      "Requires Linear issues to have proper status workflow with review states"
    ]
  }
};

export const README_CONTENT = {
  title: "DORA Metrics Dashboard - How It Works",
  lastUpdated: new Date().toLocaleDateString(),
  introduction: `This dashboard calculates and visualizes the four key DORA (DevOps Research and Assessment) metrics that measure software delivery performance. Each metric provides insights into different aspects of your development and deployment process.`,
  
  dataSource: {
    title: "Data Source & Integration",
    description: "Metrics are calculated from Linear issues using the GraphQL API. The dashboard analyzes issue states, timestamps, labels, and estimates to derive meaningful insights.",
    scope: "Analysis can be filtered by team, cycle, or time period (7/30/90 days) to provide relevant insights for your specific context."
  },
  
  calculations: {
    title: "Calculation Methodology",
    businessHours: "All time-based metrics use business hours calculation (Monday-Friday, excluding weekends) and convert to business days assuming 8 hours per day.",
    estimates: "Lead time analysis requires issues to have story point estimates for accurate calculation.",
    labels: "Failure detection relies on issue labels containing keywords like 'incident', 'bug', 'hotfix', 'rollback', or 'revert'.",
    trends: "Trend calculations compare current period performance with the previous equivalent period."
  },

  cycleTimeAnalysis: {
    title: "Cycle Time Analysis - Complete Methodology",
    definition: "Time from 'In Progress' to 'Deployed' status, measuring the complete development cycle duration.",
    calculationSteps: [
      "1. Extract issue status history from Linear API",
      "2. Find timestamp when issue entered 'In Progress' state",
      "3. Find timestamp when issue reached 'Deployed'/'Completed' state", 
      "4. Calculate business hours between these timestamps",
      "5. Convert to business days (8 hours = 1 business day)"
    ],
    businessHoursAlgorithm: {
      workingHours: "9:00 AM - 6:00 PM (9 hours per day)",
      workingDays: "Monday through Friday",
      example: "Friday 4:00 PM → Monday 11:00 AM = 4 business hours (2 hours Friday + 2 hours Monday)"
    },
    dataCollection: {
      requiredFields: ["id", "title", "estimate", "createdAt", "completedAt", "statusHistory"],
      filteringCriteria: [
        "Issues must have story point estimates",
        "Issues must have completed status (Deployed/Done)",
        "Issues must have valid status history with 'In Progress' transition",
        "Issues must be within selected time period"
      ]
    },

  },

  storyPointAccuracy: {
    title: "Story Point Accuracy Analysis - Detailed Calculation",
    coreFormula: "Accuracy = (Expected Time / Actual Time) × 100",
    methodology: [
      "1. Establish team baseline using historical data (last 90 days)",
      "2. Calculate expected time per story point from team average",
      "3. Compare actual cycle time vs expected time for each story",
      "4. Calculate accuracy percentage using core formula",
      "5. Categorize accuracy into performance bands"
    ],
    teamBaseline: {
      calculation: "Average hours per story point = Total cycle time hours / Total story points",
      example: "Team completed 100 story points in 800 hours = 8 hours per story point baseline"
    },
    accuracyCategories: {
      excellent: "80-120% (within 20% of estimate)",
      good: "60-140% (within 40% of estimate)", 
      poor: "< 60% or > 140% (significantly over/under estimated)"
    },
    storyPointBreakdown: {
      "1-point": {
        expectedRange: "2-6 hours",
        accuracyTarget: "> 80%",
        description: "Small, well-understood tasks"
      },
      "2-point": {
        expectedRange: "4-12 hours", 
        accuracyTarget: "> 70%",
        description: "Medium tasks with some complexity"
      },
      "3-point": {
        expectedRange: "8-20 hours",
        accuracyTarget: "> 60%", 
        description: "Larger tasks requiring investigation"
      },
      "5-point": {
        expectedRange: "16-40 hours",
        accuracyTarget: "> 50%",
        description: "Complex tasks with unknowns"
      },
      "8-point": {
        expectedRange: "32+ hours",
        accuracyTarget: "Often needs splitting",
        description: "Very large tasks, consider breaking down"
      }
    },

  },

  bottleneckDetection: {
    title: "Bottleneck Detection Algorithm",
    thresholdMultiplier: "Default 1.5x expected time triggers alert",
    severityLevels: {
      low: "1.5x - 2.0x expected time",
      medium: "2.0x - 3.0x expected time", 
      high: "3.0x+ expected time"
    },
    realExample: {
      scenario: "2-point story with 8-hour team baseline",
      expected: "16 hours (2 points × 8 hours)",
      actual: "24 hours",
      calculation: "24 / 16 = 1.5x threshold → Low severity bottleneck alert"
    },
    alertTriggers: [
      "Tasks taking 1.5x+ expected time trigger low severity alerts",
      "Tasks taking 2.0x+ expected time trigger medium severity alerts", 
      "Tasks taking 3.0x+ expected time trigger high severity alerts"
    ]
  },

  confidenceIntervals: {
    title: "Confidence Intervals & Predictive Analytics",
    methodology: "95% confidence interval using t-distribution for small sample sizes",
    calculation: "Mean ± (t-value × Standard Error)",
    predictiveExample: {
      scenario: "3-point stories analysis (n=20)",
      mean: "15.5 hours",
      standardDeviation: "4.2 hours", 
      confidenceInterval: "12.6 - 18.4 hours",
      interpretation: "95% confident that 3-point stories will take between 12.6 and 18.4 hours"
    },
    capacityPlanning: "Use confidence intervals to provide realistic delivery estimates and identify stories that need breakdown",
    practicalUse: "Provides realistic delivery estimates and helps identify stories that need breakdown before starting work"
  },
  
  limitations: {
    title: "Current Limitations & Assumptions",
    items: [
      "Code review time requires Linear issues to have proper status workflow with review states tracked in status history",
      "Incident detection time uses issue creation date as proxy for when incident was first detected",
      "Deployment cycles are inferred from issue completion dates rather than actual deployment events",
      "Business hours calculation assumes standard Monday-Friday work schedule",
      "Failure detection depends on consistent labeling practices in Linear"
    ]
  },
  
  improvements: {
    title: "Recommended Improvements for Production Use",
    items: [
      "Integrate with actual deployment systems (CI/CD pipelines) for precise deployment frequency",
      "Implement incident management workflow with proper timestamp tracking for when incidents are first detected",
      "Use Linear webhooks to capture real-time state changes and label applications",
      "Customize business hours calculation based on your team's actual working schedule",
      "Set up consistent Linear workflow states across teams for better code review tracking"
    ]
  }
};