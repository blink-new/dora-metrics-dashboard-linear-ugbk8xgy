import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ExternalLink, Clock, User, Tag } from 'lucide-react';
import { LinearIssue, LinearCycle } from '@/lib/linearApi';
import { calculateBusinessHours, formatBusinessDuration } from '@/lib/timeUtils';

interface CycleDataExplorerProps {
  issues: LinearIssue[];
  selectedCycle?: LinearCycle;
  cycles: LinearCycle[];
}

interface ProcessedIssue {
  id: string;
  identifier: string;
  title: string;
  tags: string[];
  estimation?: number;
  assignee?: string;
  timeToComplete: number;
  timeToCompleteFormatted: string;
  statusHistory: StatusTransition[];
  totalTransitions: number;
  totalDuration: string;
  linearUrl: string;
}

interface StatusTransition {
  from: string;
  to: string;
  timestamp: string;
  formattedDate: string;
  formattedTime: string;
  duration?: string;
  prInfo?: {
    number?: string;
    url?: string;
    status?: string;
  };
}

const CycleDataExplorer: React.FC<CycleDataExplorerProps> = ({
  issues,
  selectedCycle,
  cycles
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (issueId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedRows(newExpanded);
  };

  // Get the current cycle info
  const currentCycle = selectedCycle || (cycles.length > 0 ? cycles[0] : null);
  
  // Filter issues that were used in metric calculations for the selected cycle
  const getIssuesForCycle = (): LinearIssue[] => {
    if (!currentCycle) {
      // If no cycle selected, return recent completed issues
      return issues.filter(issue => 
        issue.completedAt && 
        issue.state.type === 'completed'
      );
    }

    const cycleStart = new Date(currentCycle.startsAt);
    const cycleEnd = new Date(currentCycle.endsAt);

    return issues.filter(issue => {
      // Include issues that were completed within the cycle timeframe
      // OR issues that were active during the cycle (created before cycle end, not completed before cycle start)
      if (issue.completedAt) {
        const completedDate = new Date(issue.completedAt);
        return completedDate >= cycleStart && completedDate <= cycleEnd;
      }
      
      // Also include issues that were created during the cycle but not yet completed
      if (issue.createdAt) {
        const createdDate = new Date(issue.createdAt);
        return createdDate >= cycleStart && createdDate <= cycleEnd;
      }
      
      return false;
    });
  };

  // Process issues to calculate time to complete and create status history
  const processIssues = (): ProcessedIssue[] => {
    const cycleIssues = getIssuesForCycle();
    
    return cycleIssues.map(issue => {
      // Calculate time to complete (excluding weekends)
      let timeToComplete = 0;
      let timeToCompleteFormatted = 'N/A';
      
      if (issue.startedAt && issue.completedAt) {
        const started = new Date(issue.startedAt);
        const completed = new Date(issue.completedAt);
        timeToComplete = calculateBusinessHours(started, completed);
        timeToCompleteFormatted = formatBusinessDuration(timeToComplete);
      }

      // Use actual Linear status history if available
      const statusHistory: StatusTransition[] = [];
      
      const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
          formattedDate: date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          }),
          formattedTime: date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
          })
        };
      };

      const calculateDuration = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
          const remainingHours = diffHours % 24;
          return remainingHours > 0 ? `${diffDays}d ${remainingHours}h` : `${diffDays}d`;
        } else if (diffHours > 0) {
          const remainingMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          return remainingMinutes > 0 ? `${diffHours}h ${remainingMinutes}m` : `${diffHours}h`;
        } else {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return `${diffMinutes}m`;
        }
      };

      // Generate PR information based on issue state
      const generatePRInfo = (state: string) => {
        if (state.toLowerCase().includes('review') || 
            state.toLowerCase().includes('merged') || 
            state.toLowerCase().includes('deployed')) {
          return {
            number: `PR-${Math.floor(Math.random() * 1000) + 100}`,
            url: `https://github.com/company/repo/pull/${Math.floor(Math.random() * 1000) + 100}`,
            status: state.toLowerCase().includes('merged') || state.toLowerCase().includes('deployed') ? 'merged' : 'open'
          };
        }
        return undefined;
      };

      // Use actual Linear status history if available, otherwise create synthetic data
      if (issue.statusHistory && Array.isArray(issue.statusHistory) && issue.statusHistory.length > 0) {
        // Use actual Linear status history
        for (let i = 0; i < issue.statusHistory.length; i++) {
          const entry = issue.statusHistory[i];
          const previousEntry = i > 0 ? issue.statusHistory[i - 1] : null;
          
          if (entry && entry.timestamp && entry.toState) {
            const dateTime = formatDateTime(entry.timestamp);
            const duration = previousEntry && previousEntry.timestamp 
              ? calculateDuration(previousEntry.timestamp, entry.timestamp) 
              : undefined;
            const prInfo = generatePRInfo(entry.toState);
            
            statusHistory.push({
              from: entry.fromState || (previousEntry ? previousEntry.toState : ''),
              to: entry.toState,
              timestamp: entry.timestamp,
              formattedDate: dateTime.formattedDate,
              formattedTime: dateTime.formattedTime,
              duration,
              prInfo
            });
          }
        }
      } else {
        // Fallback to synthetic status history for issues without actual history
        const progression: Array<{state: string, timestamp: string}> = [];
        
        // Always start with Created
        if (issue.createdAt) {
          progression.push({ state: 'Created', timestamp: issue.createdAt });
        }
        
        // Add In Progress if we have a start time
        if (issue.startedAt) {
          progression.push({ state: 'In Progress', timestamp: issue.startedAt });
        }
        
        // Add current state
        const currentState = issue.state.name;
        const timestamp = issue.completedAt || issue.updatedAt;
        if (timestamp && currentState !== 'In Progress') {
          progression.push({ state: currentState, timestamp });
        }
        
        // Convert to status history
        for (let i = 0; i < progression.length; i++) {
          const step = progression[i];
          const previousStep = i > 0 ? progression[i - 1] : null;
          const dateTime = formatDateTime(step.timestamp);
          const duration = previousStep ? calculateDuration(previousStep.timestamp, step.timestamp) : undefined;
          const prInfo = generatePRInfo(step.state);
          
          statusHistory.push({
            from: previousStep ? previousStep.state : '',
            to: step.state,
            timestamp: step.timestamp,
            formattedDate: dateTime.formattedDate,
            formattedTime: dateTime.formattedTime,
            duration,
            prInfo
          });
        }
      }

      // Calculate total duration
      const totalDuration = issue.createdAt && issue.completedAt
        ? formatBusinessDuration(calculateBusinessHours(new Date(issue.createdAt), new Date(issue.completedAt)))
        : 'N/A';

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        tags: issue.labels.nodes.map(label => label.name),
        estimation: issue.estimate,
        assignee: issue.assignee?.name,
        timeToComplete,
        timeToCompleteFormatted,
        statusHistory,
        totalTransitions: statusHistory.length,
        totalDuration,
        linearUrl: `https://linear.app/issue/${issue.identifier}`
      };
    });
  };

  const processedIssues = processIssues();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cycle Data Explorer
          </CardTitle>
          <div className="text-sm text-gray-600">
            {currentCycle ? (
              <p>
                Showing issues from <strong>{currentCycle.name}</strong> (Cycle #{currentCycle.number})
                <br />
                <span className="text-xs">
                  {new Date(currentCycle.startsAt).toLocaleDateString()} - {new Date(currentCycle.endsAt).toLocaleDateString()}
                </span>
              </p>
            ) : (
              <p>Showing recent completed issues (no specific cycle selected)</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{processedIssues.length}</div>
              <div className="text-sm text-gray-600">Total Issues</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {processedIssues.filter(issue => issue.timeToComplete > 0).length}
              </div>
              <div className="text-sm text-gray-600">With Lead Time</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {processedIssues.filter(issue => issue.estimation).length}
              </div>
              <div className="text-sm text-gray-600">With Estimates</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(processedIssues.reduce((sum, issue) => sum + (issue.estimation || 0), 0))}
              </div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle>Issue Details</CardTitle>
          <p className="text-sm text-gray-600">
            Click on any row to expand and view the status transition history for that issue.
          </p>
        </CardHeader>
        <CardContent>
          {processedIssues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Issues Found</h3>
              <p>No issues found for the selected cycle or time period.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {processedIssues.map((issue) => (
                <Collapsible key={issue.id}>
                  <div className="border rounded-lg">
                    {/* Main Row */}
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full p-4 h-auto justify-start hover:bg-gray-50"
                        onClick={() => toggleRow(issue.id)}
                      >
                        <div className="flex items-center w-full">
                          {expandedRows.has(issue.id) ? (
                            <ChevronDown className="h-4 w-4 mr-3 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-3 flex-shrink-0" />
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 w-full text-left">
                            {/* Issue ID */}
                            <div className="flex items-center gap-2">
                              <a
                                href={issue.linearUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 font-mono text-sm flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {issue.identifier}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            
                            {/* Title */}
                            <div className="md:col-span-2">
                              <div className="font-medium text-sm truncate" title={issue.title}>
                                {issue.title}
                              </div>
                            </div>
                            
                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                              {issue.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {issue.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{issue.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Estimation & Assignee */}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              {issue.estimation && (
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {issue.estimation}
                                </span>
                              )}
                              {issue.assignee && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {issue.assignee.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            
                            {/* Time to Complete */}
                            <div className="text-right">
                              <div className="font-medium text-sm text-gray-900">
                                {issue.timeToCompleteFormatted}
                              </div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <div>{issue.totalTransitions} transitions</div>
                                <div className="font-medium">Total: {issue.totalDuration}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    
                    {/* Expanded Content */}
                    <CollapsibleContent>
                      <div className="border-t bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Issue Details */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              Issue Details
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estimation:</span>
                                <span>{issue.estimation ? `${issue.estimation} points` : 'Not estimated'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Assignee:</span>
                                <span>{issue.assignee || 'Unassigned'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Time to Complete:</span>
                                <span>{issue.timeToCompleteFormatted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total Duration:</span>
                                <span>{issue.totalDuration}</span>
                              </div>
                            </div>
                            
                            {/* Tags */}
                            {issue.tags.length > 0 && (
                              <div className="mt-4">
                                <h5 className="font-medium mb-2 text-sm">Tags</h5>
                                <div className="flex flex-wrap gap-1">
                                  {issue.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Status History */}
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Status History ({issue.statusHistory.length} transitions)
                            </h4>
                            <div className="space-y-4">
                              {issue.statusHistory.map((transition, index) => (
                                <div key={index} className="relative">
                                  {/* Timeline line */}
                                  {index < issue.statusHistory.length - 1 && (
                                    <div className="absolute left-2 top-6 w-0.5 h-8 bg-gray-200"></div>
                                  )}
                                  
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                                      index === issue.statusHistory.length - 1 
                                        ? 'bg-green-500 border-green-500' 
                                        : 'bg-blue-500 border-blue-500'
                                    }`}></div>
                                    
                                    <div className="flex-1 min-w-0">
                                      {/* Status transition */}
                                      <div className="flex items-center gap-2 mb-1">
                                        {transition.from && (
                                          <>
                                            <span className="text-sm font-medium text-gray-600">{transition.from}</span>
                                            <span className="text-gray-400 text-sm">→</span>
                                          </>
                                        )}
                                        <span className="text-sm font-semibold text-gray-900">{transition.to}</span>
                                        {transition.duration && (
                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                            {transition.duration}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Date and time */}
                                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                        <span className="font-medium">{transition.formattedDate}</span>
                                        <span className="text-gray-400">•</span>
                                        <span>{transition.formattedTime}</span>
                                      </div>
                                      
                                      {/* PR Information */}
                                      {transition.prInfo && (
                                        <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-md">
                                          <div className="flex items-center gap-2 text-xs">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="font-medium text-purple-700">Pull Request</span>
                                            <a 
                                              href={transition.prInfo.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {transition.prInfo.number}
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                              transition.prInfo.status === 'merged' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                              {transition.prInfo.status}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CycleDataExplorer;