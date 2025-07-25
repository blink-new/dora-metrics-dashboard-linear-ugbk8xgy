export interface LinearHistoryEntry {
  id: string;
  createdAt: string;
  type: string;
  fromState?: {
    id: string;
    name: string;
  };
  toState?: {
    id: string;
    name: string;
  };
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  estimate?: number;
  priority: number;
  state: {
    id: string;
    name: string;
    type: string;
  };
  team: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  startedAt?: string;
  labels: {
    nodes: Array<{
      id: string;
      name: string;
      color: string;
    }>;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
    startsAt: string;
    endsAt: string;
  };
  // Generated status history for DORA metrics
  statusHistory?: Array<{
    id: string;
    timestamp: string;
    fromState?: string;
    toState: string;
    duration?: string;
    pullRequest?: {
      number: string;
      status: string;
    };
  }>;
}

export interface LinearCycle {
  id: string;
  name: string;
  number: number;
  startsAt: string;
  endsAt: string;
  team: {
    id: string;
    name: string;
  };
}

export interface LinearApiConfig {
  apiKey: string;
  teamId?: string;
}

// Universal status history generator for all Linear issues
export function generateStatusHistory(issue: LinearIssue): LinearIssue {
  // If already has status history, return as-is
  if (issue.statusHistory && issue.statusHistory.length > 0) {
    return issue;
  }

  const createdAt = new Date(issue.createdAt);
  const updatedAt = new Date(issue.updatedAt);
  const totalDuration = updatedAt.getTime() - createdAt.getTime();
  
  // Determine workflow based on final state and issue type
  const finalState = issue.state.name.toLowerCase();
  const isIncident = issue.labels.nodes.some(label => 
    ['incident', 'critical', 'hotfix'].includes(label.name.toLowerCase())
  );
  const isBug = issue.labels.nodes.some(label => 
    label.name.toLowerCase() === 'bug'
  );
  
  let workflow: string[] = [];
  
  // Define workflows based on final state and issue type
  if (finalState === 'deployed') {
    if (isIncident) {
      workflow = ['Created', 'In Progress', 'Deployed'];
    } else {
      workflow = ['Created', 'In Progress', 'Ready', 'Code Review', 'Testing', 'Deployed'];
    }
  } else if (finalState === 'merged') {
    if (isBug) {
      workflow = ['Created', 'In Progress', 'Ready', 'Code Review', 'Merged'];
    } else {
      workflow = ['Created', 'In Progress', 'Ready', 'Code Review', 'Merged'];
    }
  } else if (finalState === 'testing') {
    workflow = ['Created', 'In Progress', 'Ready', 'Code Review', 'Testing'];
  } else if (finalState === 'code review') {
    workflow = ['Created', 'In Progress', 'Ready', 'Code Review'];
  } else if (finalState === 'in progress') {
    workflow = ['Created', 'In Progress'];
  } else {
    // Default workflow for any other state
    workflow = ['Created', 'In Progress', 'Ready', finalState];
  }

  // Generate timestamps for each state transition
  const timestamps: Date[] = [];
  
  // First, generate all timestamps
  for (let index = 0; index < workflow.length; index++) {
    let timestamp: Date;
    
    if (index === 0) {
      // First state is creation time
      timestamp = createdAt;
    } else if (index === workflow.length - 1) {
      // Last state is completion/update time
      timestamp = updatedAt;
    } else {
      // Intermediate states - distribute evenly with some randomness
      const progress = index / (workflow.length - 1);
      const baseTime = createdAt.getTime() + (totalDuration * progress);
      
      // Add some realistic variance (±10% of segment duration)
      const segmentDuration = totalDuration / (workflow.length - 1);
      const variance = (Math.random() - 0.5) * 0.2 * segmentDuration;
      timestamp = new Date(baseTime + variance);
    }
    
    timestamps.push(timestamp);
  }

  // Then, create the status history using the pre-calculated timestamps
  const statusHistory = workflow.map((state, index) => {
    const timestamp = timestamps[index];

    // Calculate duration from previous state
    let duration: string | undefined;
    if (index > 0) {
      const prevTimestamp = timestamps[index - 1];
      const durationMs = timestamp.getTime() - prevTimestamp.getTime();
      
      if (durationMs < 60 * 60 * 1000) { // Less than 1 hour
        duration = `${Math.round(durationMs / (60 * 1000))}m`;
      } else if (durationMs < 24 * 60 * 60 * 1000) { // Less than 1 day
        const hours = Math.round(durationMs / (60 * 60 * 1000) * 10) / 10;
        duration = `${hours}h`;
      } else { // 1 day or more
        const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
        const hours = Math.round((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        duration = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
      }
    }

    // Add pull request info for Code Review and Merged states
    let pullRequest: { number: string; status: string } | undefined;
    if (state === 'Code Review' || state === 'Merged') {
      const prNumber = `PR-${Math.floor(Math.random() * 900) + 100}`;
      pullRequest = {
        number: prNumber,
        status: state === 'Merged' ? 'merged' : 'open'
      };
    }

    return {
      id: `${issue.id}-${index}`,
      timestamp: timestamp.toISOString(),
      fromState: index > 0 ? workflow[index - 1] : undefined,
      toState: state,
      duration,
      pullRequest
    };
  });

  return {
    ...issue,
    statusHistory
  };
}

class LinearApiClient {
  private apiKey: string;
  private proxyUrl = 'https://ugbk8xgy--linear-proxy.functions.blink.new';

  constructor(config: LinearApiConfig) {
    this.apiKey = config.apiKey;
  }

  private async makeRequest(query: string, variables?: any): Promise<any> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
          apiKey: this.apiKey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        // Handle specific Linear API errors
        if (data.error.includes('Authentication required') || 
            data.error.includes('not authenticated') ||
            data.error.includes('Bearer token') ||
            data.error.includes('API key')) {
          throw new Error('Invalid Linear API key. Please check your API key and try again.');
        }
        throw new Error(`Linear API error: ${data.error}`);
      }
      
      if (data.errors) {
        const errorMessages = data.errors.map((e: any) => e.message);
        // Handle authentication errors specifically
        if (errorMessages.some(msg => 
          msg.includes('Authentication required') || 
          msg.includes('not authenticated') ||
          msg.includes('Bearer token') ||
          msg.includes('API key'))) {
          throw new Error('Invalid Linear API key. Please check your API key and try again.');
        }
        throw new Error(`Linear GraphQL error: ${errorMessages.join(', ')}`);
      }

      return data.data;
    } catch (error) {
      console.error('Linear API request failed:', error);
      throw error;
    }
  }

  async getTeams() {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;

    const data = await this.makeRequest(query);
    return data.teams.nodes || [];
  }

  async getCycles(teamId?: string): Promise<LinearCycle[]> {
    let query: string;
    let variables: any = {};

    if (teamId && teamId !== 'all') {
      query = `
        query($teamId: ID!) {
          cycles(
            filter: {
              team: { id: { eq: $teamId } }
            }
            first: 50
          ) {
            nodes {
              id
              name
              number
              startsAt
              endsAt
              team {
                id
                name
              }
            }
          }
        }
      `;
      variables = { teamId };
    } else {
      query = `
        query {
          cycles(
            first: 50
          ) {
            nodes {
              id
              name
              number
              startsAt
              endsAt
              team {
                id
                name
              }
            }
          }
        }
      `;
    }

    const data = await this.makeRequest(query, variables);
    const cycles = data.cycles.nodes || [];
    
    // Remove duplicates by id and sort cycles by start date (most recent first)
    const uniqueCycles = cycles.filter((cycle: LinearCycle, index: number, self: LinearCycle[]) => 
      self.findIndex(c => c.id === cycle.id) === index
    );
    
    return uniqueCycles.sort((a: LinearCycle, b: LinearCycle) => 
      new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    );
  }

  async getIssues(teamId?: string, cycleId?: string, days: number = 30): Promise<LinearIssue[]> {
    // Build the query based on filters - NOW INCLUDING ACTUAL HISTORY
    let query: string;
    let variables: any = {};

    const issueFields = `
      id
      identifier
      title
      description
      estimate
      priority
      state {
        id
        name
        type
      }
      team {
        id
        name
      }
      assignee {
        id
        name
        email
      }
      createdAt
      updatedAt
      completedAt
      startedAt
      cycle {
        id
        name
        number
        startsAt
        endsAt
      }
      labels {
        nodes {
          id
          name
          color
        }
      }
      history {
        nodes {
          id
          createdAt
          fromState {
            id
            name
          }
          toState {
            id
            name
          }
          actor {
            id
            name
          }
        }
      }
    `;

    if (teamId && teamId !== 'all' && cycleId && cycleId !== 'all') {
      // Both team and cycle specified
      query = `
        query($teamId: ID!, $cycleId: ID!) {
          issues(
            filter: {
              team: { id: { eq: $teamId } }
              cycle: { id: { eq: $cycleId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { teamId, cycleId };
    } else if (teamId && teamId !== 'all') {
      // Only team specified
      query = `
        query($teamId: ID!) {
          issues(
            filter: {
              team: { id: { eq: $teamId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { teamId };
    } else if (cycleId && cycleId !== 'all') {
      // Only cycle specified
      query = `
        query($cycleId: ID!) {
          issues(
            filter: {
              cycle: { id: { eq: $cycleId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { cycleId };
    } else {
      // No specific filters - get recent issues
      query = `
        query {
          issues(
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
    }

    const data = await this.makeRequest(query, variables);
    const issues = data.issues.nodes || [];
    
    // Filter by date on the client side
    let filteredIssues = issues;
    if (days && days > 0) {
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      filteredIssues = issues.filter((issue: LinearIssue) => {
        const updatedAt = new Date(issue.updatedAt);
        return updatedAt >= dateFilter;
      });
    }
    
    // Convert actual Linear history to our status history format
    return filteredIssues.map((issue: any) => this.convertLinearHistoryToStatusHistory(issue));
  }

  async getIssuesWithHistory(teamId?: string, cycleId?: string, days: number = 30): Promise<LinearIssue[]> {
    // Build the query based on filters - using available fields for tracking changes
    let query: string;
    let variables: any = {};

    const issueFields = `
      id
      identifier
      title
      description
      estimate
      priority
      state {
        id
        name
        type
      }
      team {
        id
        name
      }
      assignee {
        id
        name
        email
      }
      createdAt
      updatedAt
      completedAt
      startedAt
      cycle {
        id
        name
        number
        startsAt
        endsAt
      }
      labels {
        nodes {
          id
          name
          color
        }
      }
      history {
        nodes {
          id
          createdAt
          fromState {
            id
            name
          }
          toState {
            id
            name
          }
          actor {
            id
            name
          }
        }
      }
    `;

    if (teamId && teamId !== 'all' && cycleId && cycleId !== 'all') {
      // Both team and cycle specified
      query = `
        query($teamId: ID!, $cycleId: ID!) {
          issues(
            filter: {
              team: { id: { eq: $teamId } }
              cycle: { id: { eq: $cycleId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { teamId, cycleId };
    } else if (teamId && teamId !== 'all') {
      // Only team specified
      query = `
        query($teamId: ID!) {
          issues(
            filter: {
              team: { id: { eq: $teamId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { teamId };
    } else if (cycleId && cycleId !== 'all') {
      // Only cycle specified
      query = `
        query($cycleId: ID!) {
          issues(
            filter: {
              cycle: { id: { eq: $cycleId } }
            }
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
      variables = { cycleId };
    } else {
      // No specific filters - get recent issues
      query = `
        query {
          issues(
            first: 200
          ) {
            nodes {
              ${issueFields}
            }
          }
        }
      `;
    }

    const data = await this.makeRequest(query, variables);
    const issues = data.issues.nodes || [];
    
    // Filter by date on the client side
    let filteredIssues = issues;
    if (days && days > 0) {
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      filteredIssues = issues.filter((issue: LinearIssue) => {
        const updatedAt = new Date(issue.updatedAt);
        return updatedAt >= dateFilter;
      });
    }
    
    // Convert actual Linear history to our status history format
    return filteredIssues.map((issue: any) => this.convertLinearHistoryToStatusHistory(issue));
  }

  /**
   * Convert actual Linear history to our status history format
   */
  private convertLinearHistoryToStatusHistory(issue: any): LinearIssue {
    // Convert the actual Linear history to our status history format
    const statusHistory = [];
    
    if (issue.history && issue.history.nodes && Array.isArray(issue.history.nodes)) {
      // Sort history by creation date
      const sortedHistory = issue.history.nodes
        .filter((entry: any) => entry && entry.createdAt && entry.toState)
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Convert each history entry to our format
      sortedHistory.forEach((entry: any, index: number) => {
        statusHistory.push({
          id: `${issue.id}-${index}`,
          timestamp: entry.createdAt,
          fromState: entry.fromState?.name || undefined,
          toState: entry.toState?.name || 'Unknown',
          duration: undefined, // We'll calculate this if needed
          pullRequest: undefined // Linear doesn't provide PR info in history
        });
      });
    }
    
    // If no history found, create a minimal history based on current state
    if (statusHistory.length === 0) {
      statusHistory.push({
        id: `${issue.id}-0`,
        timestamp: issue.createdAt,
        fromState: undefined,
        toState: 'Created',
        duration: undefined,
        pullRequest: undefined
      });
      
      if (issue.state && issue.state.name !== 'Created') {
        statusHistory.push({
          id: `${issue.id}-1`,
          timestamp: issue.updatedAt,
          fromState: 'Created',
          toState: issue.state.name,
          duration: undefined,
          pullRequest: undefined
        });
      }
    }
    
    // Return the issue with the actual status history
    return {
      ...issue,
      statusHistory
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = `
        query {
          viewer {
            id
            name
            email
          }
        }
      `;
      
      await this.makeRequest(query);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default LinearApiClient;