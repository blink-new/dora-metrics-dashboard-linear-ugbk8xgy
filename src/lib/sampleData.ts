import { LinearIssue } from './linearApi';

// Raw sample data for testing the dashboard without Linear API
// Note: Status history will be generated at runtime to avoid circular dependencies
const rawSampleIssues: LinearIssue[] = [
  {
    id: '1',
    identifier: 'ENG-101',
    title: 'Implement user authentication system',
    description: 'Add JWT-based authentication with login/logout functionality',
    estimate: 5,
    priority: 1,
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-18T16:30:00Z',
    completedAt: '2024-01-18T16:30:00Z',
    startedAt: '2024-01-16T09:00:00Z', // Started 1 day after creation
    labels: {
      nodes: [
        { id: 'label-1', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '2',
    identifier: 'ENG-102',
    title: 'Fix payment processing bug',
    description: 'Resolve issue with failed payment notifications',
    estimate: 2,
    priority: 0, // High priority
    state: {
      id: 'merged',
      name: 'Merged',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-16T14:00:00Z',
    updatedAt: '2024-01-17T11:45:00Z',
    completedAt: '2024-01-17T11:45:00Z',
    startedAt: '2024-01-16T15:00:00Z', // Started 1 hour after creation
    labels: {
      nodes: [
        { id: 'label-2', name: 'bug', color: '#EF4444' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' }
      ]
    }
  },
  {
    id: '3',
    identifier: 'ENG-103',
    title: 'Optimize database queries',
    description: 'Improve performance of user dashboard queries',
    estimate: 3,
    priority: 2,
    state: {
      id: 'testing',
      name: 'Testing',
      type: 'started'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-10T08:30:00Z',
    updatedAt: '2024-01-14T17:20:00Z',
    completedAt: '2024-01-14T17:20:00Z',
    startedAt: '2024-01-11T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-3', name: 'performance', color: '#F59E0B' },
        { id: 'label-enhancement', name: 'enhancement', color: '#8B5CF6' }
      ]
    }
  },
  {
    id: '4',
    identifier: 'ENG-104',
    title: 'Add dark mode support',
    description: 'Implement dark theme across the application',
    estimate: 8,
    priority: 3,
    state: {
      id: 'code-review',
      name: 'Code Review',
      type: 'started'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-3',
      name: 'Carol Davis',
      email: 'carol@company.com'
    },
    createdAt: '2024-01-12T10:15:00Z',
    updatedAt: '2024-01-19T14:30:00Z',
    startedAt: '2024-01-13T09:00:00Z',
    labels: {
      nodes: [
        { id: 'label-1', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '5',
    identifier: 'ENG-105',
    title: 'Setup CI/CD pipeline',
    description: 'Configure automated testing and deployment',
    estimate: 5,
    priority: 1,
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-08T13:45:00Z',
    updatedAt: '2024-01-12T16:00:00Z',
    completedAt: '2024-01-12T16:00:00Z',
    startedAt: '2024-01-09T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-4', name: 'infrastructure', color: '#8B5CF6' },
        { id: 'label-feature', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '6',
    identifier: 'ENG-106',
    title: 'Mobile app responsive design',
    description: 'Ensure app works well on mobile devices',
    estimate: 3,
    priority: 2,
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-3',
      name: 'Carol Davis',
      email: 'carol@company.com'
    },
    createdAt: '2024-01-14T11:20:00Z',
    updatedAt: '2024-01-19T13:15:00Z',
    completedAt: '2024-01-19T13:15:00Z',
    startedAt: '2024-01-15T10:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-5', name: 'mobile', color: '#06B6D4' },
        { id: 'label-enhancement', name: 'enhancement', color: '#8B5CF6' }
      ]
    }
  },
  {
    id: '7',
    identifier: 'ENG-107',
    title: 'API rate limiting',
    description: 'Implement rate limiting for public API endpoints',
    estimate: 2,
    priority: 1,
    state: {
      id: 'in-progress',
      name: 'In Progress',
      type: 'started'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-18T15:30:00Z',
    updatedAt: '2024-01-18T15:30:00Z',
    labels: {
      nodes: [
        { id: 'label-6', name: 'security', color: '#DC2626' }
      ]
    }
  },
  {
    id: '8',
    identifier: 'ENG-108',
    title: 'User onboarding flow',
    description: 'Create guided tour for new users',
    estimate: 5,
    priority: 2,
    state: {
      id: 'merged',
      name: 'Merged',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-05T09:15:00Z',
    updatedAt: '2024-01-11T14:45:00Z',
    completedAt: '2024-01-11T14:45:00Z',
    startedAt: '2024-01-06T10:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-7', name: 'ux', color: '#EC4899' },
        { id: 'label-feature', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '9',
    identifier: 'ENG-109',
    title: 'Email notification system',
    description: 'Send notifications for important events',
    estimate: 3,
    priority: 3,
    state: {
      id: 'testing',
      name: 'Testing',
      type: 'started'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-3',
      name: 'Carol Davis',
      email: 'carol@company.com'
    },
    createdAt: '2024-01-13T16:00:00Z',
    updatedAt: '2024-01-17T12:30:00Z',
    completedAt: '2024-01-17T12:30:00Z',
    startedAt: '2024-01-14T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-1', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '10',
    identifier: 'ENG-110',
    title: 'Performance monitoring',
    description: 'Add application performance monitoring',
    estimate: 8,
    priority: 1,
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-02T08:00:00Z',
    updatedAt: '2024-01-16T18:00:00Z',
    completedAt: '2024-01-16T18:00:00Z',
    startedAt: '2024-01-03T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-3', name: 'performance', color: '#F59E0B' },
        { id: 'label-8', name: 'monitoring', color: '#6366F1' },
        { id: 'label-feature', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '11',
    identifier: 'ENG-111',
    title: 'Critical security vulnerability fix',
    description: 'Fix SQL injection vulnerability in user search',
    estimate: 1,
    priority: 0, // Highest priority
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-19T10:00:00Z',
    updatedAt: '2024-01-19T14:30:00Z',
    completedAt: '2024-01-19T14:30:00Z',
    startedAt: '2024-01-19T10:30:00Z', // Started 30 minutes after creation
    labels: {
      nodes: [
        { id: 'label-bug', name: 'bug', color: '#EF4444' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' },
        { id: 'label-hotfix', name: 'hotfix', color: '#F59E0B' }
      ]
    }
  },
  {
    id: '12',
    identifier: 'ENG-112',
    title: 'Database backup system',
    description: 'Implement automated database backups',
    estimate: 3,
    priority: 2,
    state: {
      id: 'merged',
      name: 'Merged',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-07T14:00:00Z',
    updatedAt: '2024-01-13T16:00:00Z',
    completedAt: '2024-01-13T16:00:00Z',
    startedAt: '2024-01-08T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-infrastructure', name: 'infrastructure', color: '#8B5CF6' },
        { id: 'label-feature', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '13',
    identifier: 'ENG-113',
    title: 'Rework user profile page',
    description: 'Redesign user profile based on feedback',
    estimate: 5,
    priority: 3,
    state: {
      id: 'code-review',
      name: 'Code Review',
      type: 'started'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-3',
      name: 'Carol Davis',
      email: 'carol@company.com'
    },
    createdAt: '2024-01-09T11:00:00Z',
    updatedAt: '2024-01-20T15:00:00Z',
    completedAt: '2024-01-20T15:00:00Z',
    startedAt: '2024-01-10T09:00:00Z', // Started next day
    labels: {
      nodes: [
        { id: 'label-rework', name: 'rework', color: '#F59E0B' },
        { id: 'label-ux', name: 'ux', color: '#EC4899' }
      ]
    }
  },
  {
    id: '14',
    identifier: 'ENG-114',
    title: 'API documentation update',
    description: 'Update API docs for new endpoints',
    estimate: 2,
    priority: 3,
    state: {
      id: 'merged',
      name: 'Merged',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-17T13:00:00Z',
    updatedAt: '2024-01-18T17:00:00Z',
    completedAt: '2024-01-18T17:00:00Z',
    startedAt: '2024-01-17T14:00:00Z', // Started 1 hour after creation
    labels: {
      nodes: [
        { id: 'label-documentation', name: 'documentation', color: '#6366F1' }
      ]
    }
  },
  {
    id: '15',
    identifier: 'ENG-115',
    title: 'Database connection timeout incident',
    description: 'Production database connections timing out causing 500 errors',
    estimate: 1,
    priority: 0, // Highest priority
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-20T14:30:00Z', // Incident detected
    updatedAt: '2024-01-20T18:45:00Z',
    completedAt: '2024-01-20T18:45:00Z', // Deployed fix
    startedAt: '2024-01-20T14:45:00Z', // Started 15 minutes after detection
    labels: {
      nodes: [
        { id: 'label-incident', name: 'incident', color: '#DC2626' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' },
        { id: 'label-hotfix', name: 'hotfix', color: '#F59E0B' }
      ]
    }
  },
  {
    id: '16',
    identifier: 'ENG-116',
    title: 'Payment gateway outage incident',
    description: 'Payment processing completely down - all transactions failing',
    estimate: 2,
    priority: 0, // Highest priority
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-19T09:15:00Z', // Incident detected
    updatedAt: '2024-01-19T15:30:00Z',
    completedAt: '2024-01-19T15:30:00Z', // Deployed fix
    startedAt: '2024-01-19T09:30:00Z', // Started 15 minutes after detection
    labels: {
      nodes: [
        { id: 'label-incident', name: 'incident', color: '#DC2626' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' },
        { id: 'label-hotfix', name: 'hotfix', color: '#F59E0B' }
      ]
    }
  },
  {
    id: '17',
    identifier: 'ENG-117',
    title: 'Memory leak causing server crashes',
    description: 'Application servers crashing every 2 hours due to memory leak',
    estimate: 3,
    priority: 0, // Highest priority
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-3',
      name: 'Carol Davis',
      email: 'carol@company.com'
    },
    createdAt: '2024-01-18T11:00:00Z', // Incident detected
    updatedAt: '2024-01-19T09:30:00Z',
    completedAt: '2024-01-19T09:30:00Z', // Deployed fix
    startedAt: '2024-01-18T11:15:00Z', // Started 15 minutes after detection
    labels: {
      nodes: [
        { id: 'label-incident', name: 'incident', color: '#DC2626' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' },
        { id: 'label-bug', name: 'bug', color: '#EF4444' }
      ]
    }
  }
  ,
  {
    id: '18',
    identifier: 'BRO-152',
    title: 'Backend Task',
    description: 'Implement new backend API endpoint for user management',
    estimate: 1,
    priority: 2,
    state: {
      id: 'deployed',
      name: 'Deployed',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    createdAt: '2024-01-20T09:00:00Z',
    updatedAt: '2024-01-22T05:00:00Z',
    completedAt: '2024-01-22T05:00:00Z',
    startedAt: '2024-01-20T10:30:00Z', // Started 1.5h after creation
    labels: {
      nodes: [
        { id: 'label-backend', name: 'backend', color: '#8B5CF6' },
        { id: 'label-feature', name: 'feature', color: '#10B981' }
      ]
    }
  },
  {
    id: '19',
    identifier: 'BRO-154',
    title: 'Bug',
    description: 'Fix critical bug in user authentication flow',
    estimate: 2,
    priority: 0, // High priority
    state: {
      id: 'merged',
      name: 'Merged',
      type: 'completed'
    },
    team: {
      id: 'team-1',
      name: 'Engineering'
    },
    assignee: {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    createdAt: '2024-01-21T14:00:00Z',
    updatedAt: '2024-01-21T21:06:00Z',
    completedAt: '2024-01-21T21:06:00Z',
    startedAt: '2024-01-21T15:00:00Z', // Started 1h after creation
    labels: {
      nodes: [
        { id: 'label-bug', name: 'bug', color: '#EF4444' },
        { id: 'label-critical', name: 'critical', color: '#DC2626' }
      ]
    }
  }
];

// Export raw sample issues (without status history)
export const sampleIssues = rawSampleIssues;

export const sampleTeams = [
  { id: 'team-1', name: 'Engineering', key: 'ENG' },
  { id: 'team-2', name: 'Design', key: 'DES' },
  { id: 'team-3', name: 'Product', key: 'PRD' },
  { id: 'team-4', name: 'Backend', key: 'BRO' }
];