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
    
    // Sort cycles by start date (most recent first) and return
    return cycles.sort((a: LinearCycle, b: LinearCycle) => 
      new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    );
  }

  async getIssues(teamId?: string, cycleId?: string, days: number = 30): Promise<LinearIssue[]> {
    // Build the query based on filters - simplified without date filtering
    let query: string;
    let variables: any = {};

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
            }
          }
        }
      `;
    }

    const data = await this.makeRequest(query, variables);
    const issues = data.issues.nodes || [];
    
    // Filter by date on the client side
    if (days && days > 0) {
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      return issues.filter((issue: LinearIssue) => {
        const updatedAt = new Date(issue.updatedAt);
        return updatedAt >= dateFilter;
      });
    }
    
    return issues;
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
    if (days && days > 0) {
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
      
      return issues.filter((issue: LinearIssue) => {
        const updatedAt = new Date(issue.updatedAt);
        return updatedAt >= dateFilter;
      });
    }
    
    return issues;
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