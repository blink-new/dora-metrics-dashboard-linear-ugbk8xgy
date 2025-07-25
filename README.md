# Enhanced DORA Metrics Dashboard with Linear Integration

A professional-grade dashboard that calculates and visualizes DORA metrics, integrates with Linear via GraphQL API, and provides advanced analytics on estimation accuracy, team velocity, and delivery bottlenecks with predictive insights.

![Dashboard Preview](https://storage.googleapis.com/blink-451505.firebasestorage.app/screenshots/dora-metrics-dashboard-linear-ugbk8xgy.sites.blink.new-1753043553666.webp)

## 🚀 Features

### Core DORA Metrics
- **Deployment Frequency**: Track how often deployments occur
- **Lead Time for Changes**: Measure time from commit to production
- **Change Failure Rate**: Monitor deployment success rates
- **Time to Recovery**: Track incident resolution times

### Advanced Analytics
- **Cycle Time Analysis**: Breakdown by story points (1, 2, 3, 5, 8) - measures In Progress to Deployed
- **Estimation Accuracy**: Track planned vs actual delivery times
- **Team Velocity**: Monitor sprint performance and trends
- **Bottleneck Detection**: Automated alerts for delayed tasks
- **Predictive Insights**: Confidence intervals and trend analysis

### Linear Integration
- **Real-time Data**: Direct GraphQL API integration with Linear
- **Issue Tracking**: Automatic sync of issues, estimates, and status
- **Cycle Analysis**: Track performance across Linear cycles
- **Team Metrics**: Multi-team support and filtering

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **API**: Linear GraphQL API integration
- **Deployment**: Netlify with edge functions

## 📊 Dashboard Sections

### 1. Overview Tab
- DORA metrics summary cards
- Trend charts and performance indicators
- Quick insights and alerts
- Code review metrics

### 2. Cycle Time Analysis
- Cycle time distribution by story points (In Progress → Deployed)
- Historical trends and patterns
- Confidence intervals
- Performance benchmarks

### 3. Estimation Analysis
- Accuracy tracking by estimate size
- Planned vs actual velocity
- Bottleneck identification
- Predictive analytics

### 4. Cycle Data Explorer
- Linear cycle performance
- Issue breakdown and analysis
- Team velocity tracking
- Export capabilities

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Linear account with API access
- Team ID from Linear workspace

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dora-metrics-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Linear API**
   - Get your Linear API key from [Linear Settings](https://linear.app/settings/api)
   - Find your Team ID in Linear workspace settings
   - Configure these in the dashboard settings panel

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuration

### Linear API Setup
1. Navigate to the dashboard settings (gear icon)
2. Enter your Linear API key
3. Add your Team ID
4. Set estimation threshold (default: 1.5x for bottleneck alerts)
5. Save configuration

### Data Sources
- **Primary**: Linear GraphQL API (real-time)
- **Fallback**: Sample data for testing
- **Export**: CSV/PDF export functionality

## 📈 Key Metrics Explained

### DORA Metrics
- **Deployment Frequency**: Measures delivery velocity with accurate cycle-based and daily-rate performance ratings
- **Lead Time for Changes**: Time from code commit (code review) to production deployment - follows DORA standard definition
- **Change Failure Rate**: Quality and stability indicator
- **Recovery Time**: Incident response effectiveness

### Team Execution Metrics
- **Cycle Time**: Time from "In Progress" to "Deployed" - measures actual execution speed of the tech team, excluding waiting time in backlog or pre-development phases
- **Estimation Accuracy**: (Actual Time / Estimated Time) × 100
- **Velocity Variance**: Standard deviation of sprint velocities
- **Bottleneck Score**: Tasks exceeding threshold multiplier

### Metric Distinction
- **Lead Time for Changes (DORA)**: Code Review → Deployed (measures deployment pipeline efficiency)
- **Cycle Time (Team Metric)**: In Progress → Deployed (measures team execution speed)

Both metrics are calculated using business hours (9am-6pm, Mon-Fri) and exclude weekends.

## 📊 Detailed Metric Calculations

### Cycle Time Analysis - Complete Calculation Methodology

**Definition**: Cycle Time measures the amount of time between when a task enters the "In Progress" state (i.e., work actually starts) and when it is "Deployed" (released to production).

**Core Formula**: 
```
Cycle Time = Deployed Timestamp - In Progress Timestamp (in business hours)
```

**Step-by-Step Calculation Process**:

1. **Data Collection**:
   ```typescript
   // Extract from Linear API
   const issue = {
     id: "issue-123",
     estimate: 3, // story points
     statusHistory: [
       { status: "Backlog", timestamp: "2024-01-01T09:00:00Z" },
       { status: "In Progress", timestamp: "2024-01-02T10:30:00Z" },
       { status: "Code Review", timestamp: "2024-01-03T14:15:00Z" },
       { status: "Deployed", timestamp: "2024-01-04T11:45:00Z" }
     ]
   }
   ```

2. **Business Hours Calculation**:
   ```typescript
   // Working hours: 9:00 AM - 6:00 PM, Monday-Friday
   const WORK_START = 9; // 9 AM
   const WORK_END = 18;   // 6 PM
   const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
   
   function calculateBusinessHours(startTime, endTime) {
     let totalHours = 0;
     let currentDate = new Date(startTime);
     const endDate = new Date(endTime);
     
     while (currentDate < endDate) {
       if (WORK_DAYS.includes(currentDate.getDay())) {
         // Calculate hours for this work day
         const dayStart = Math.max(currentDate.getHours(), WORK_START);
         const dayEnd = Math.min(WORK_END, 
           currentDate.toDateString() === endDate.toDateString() 
             ? endDate.getHours() 
             : WORK_END
         );
         
         if (dayEnd > dayStart) {
           totalHours += (dayEnd - dayStart);
         }
       }
       currentDate.setDate(currentDate.getDate() + 1);
       currentDate.setHours(WORK_START, 0, 0, 0);
     }
     
     return totalHours;
   }
   ```

3. **Example Calculation**:
   ```
   Issue starts "In Progress": Friday 4:00 PM
   Issue "Deployed": Monday 11:00 AM
   
   Calculation:
   - Friday 4:00 PM - 6:00 PM = 2 hours
   - Saturday & Sunday = 0 hours (weekend)
   - Monday 9:00 AM - 11:00 AM = 2 hours
   
   Total Cycle Time = 4 business hours
   ```

4. **Filtering Criteria**:
   ```typescript
   function isValidForCycleTime(issue) {
     return (
       issue.statusHistory.some(h => h.status === "In Progress") &&
       issue.statusHistory.some(h => h.status === "Deployed") &&
       issue.estimate > 0 &&
       issue.completedAt !== null
     );
   }
   ```

### Story Point Accuracy Analysis - Detailed Calculation

**Core Accuracy Formula**:
```
Accuracy Percentage = (Expected Time / Actual Time) × 100

Where:
- Expected Time = Story Points × Team's Average Hours per Point
- Actual Time = Calculated Cycle Time in business hours
```

**Step-by-Step Accuracy Calculation**:

1. **Establish Team Baselines** (using historical data):
   ```typescript
   // Calculate average cycle time per story point
   const storyPointBaselines = {
     1: calculateAverage(onePointStories.map(s => s.cycleTime)), // e.g., 4 hours
     2: calculateAverage(twoPointStories.map(s => s.cycleTime)), // e.g., 8 hours
     3: calculateAverage(threePointStories.map(s => s.cycleTime)), // e.g., 16 hours
     5: calculateAverage(fivePointStories.map(s => s.cycleTime)), // e.g., 32 hours
     8: calculateAverage(eightPointStories.map(s => s.cycleTime)) // e.g., 64 hours
   };
   ```

2. **Calculate Individual Story Accuracy**:
   ```typescript
   function calculateStoryAccuracy(story) {
     const expectedTime = storyPointBaselines[story.estimate];
     const actualTime = story.cycleTime;
     
     if (!expectedTime || !actualTime) return null;
     
     const accuracy = (expectedTime / actualTime) * 100;
     
     return {
       storyId: story.id,
       estimate: story.estimate,
       expectedTime,
       actualTime,
       accuracy: Math.round(accuracy),
       category: getAccuracyCategory(accuracy),
       variance: actualTime - expectedTime
     };
   }
   
   function getAccuracyCategory(accuracy) {
     if (accuracy >= 80 && accuracy <= 120) return "Excellent";
     if (accuracy >= 60 && accuracy <= 140) return "Good";
     return "Poor";
   }
   ```

3. **Story Point Breakdown with Expected Ranges**:

   **1-Point Stories** (Simple tasks, bug fixes):
   ```
   Expected Range: 2-6 business hours
   Target Accuracy: >80%
   Calculation: If baseline is 4 hours
   - Excellent: 3.2-4.8 hours (80-120%)
   - Good: 2.4-6.4 hours (60-140%)
   - Poor: <2.4 or >6.4 hours
   ```

   **2-Point Stories** (Small features):
   ```
   Expected Range: 4-12 business hours
   Target Accuracy: >70%
   Calculation: If baseline is 8 hours
   - Excellent: 6.4-9.6 hours (80-120%)
   - Good: 4.8-12.8 hours (60-140%)
   - Poor: <4.8 or >12.8 hours
   ```

   **3-Point Stories** (Medium features):
   ```
   Expected Range: 8-20 business hours
   Target Accuracy: >60%
   Calculation: If baseline is 16 hours
   - Excellent: 12.8-19.2 hours (80-120%)
   - Good: 9.6-25.6 hours (60-140%)
   - Poor: <9.6 or >25.6 hours
   ```

   **5-Point Stories** (Complex features):
   ```
   Expected Range: 16-40 business hours
   Target Accuracy: >50%
   Calculation: If baseline is 32 hours
   - Excellent: 25.6-38.4 hours (80-120%)
   - Good: 19.2-51.2 hours (60-140%)
   - Poor: <19.2 or >51.2 hours
   ```

   **8-Point Stories** (Large features - should be split):
   ```
   Expected Range: 32+ business hours
   Target Accuracy: Often poor due to complexity
   Calculation: If baseline is 64 hours
   - Excellent: 51.2-76.8 hours (80-120%)
   - Good: 38.4-102.4 hours (60-140%)
   - Poor: <38.4 or >102.4 hours
   - Recommendation: Split into smaller stories
   ```

4. **Aggregate Accuracy Metrics**:
   ```typescript
   function calculateTeamAccuracyMetrics(stories) {
     const accuracyData = stories.map(calculateStoryAccuracy).filter(Boolean);
     
     return {
       overallAccuracy: calculateAverage(accuracyData.map(d => d.accuracy)),
       accuracyByPoints: {
         1: calculateAverage(accuracyData.filter(d => d.estimate === 1).map(d => d.accuracy)),
         2: calculateAverage(accuracyData.filter(d => d.estimate === 2).map(d => d.accuracy)),
         3: calculateAverage(accuracyData.filter(d => d.estimate === 3).map(d => d.accuracy)),
         5: calculateAverage(accuracyData.filter(d => d.estimate === 5).map(d => d.accuracy)),
         8: calculateAverage(accuracyData.filter(d => d.estimate === 8).map(d => d.accuracy))
       },
       categoryBreakdown: {
         excellent: accuracyData.filter(d => d.category === "Excellent").length,
         good: accuracyData.filter(d => d.category === "Good").length,
         poor: accuracyData.filter(d => d.category === "Poor").length
       },
       totalStories: accuracyData.length
     };
   }
   ```

### Bottleneck Detection Algorithm

**Threshold-Based Detection**:
```typescript
function detectBottlenecks(stories, thresholdMultiplier = 1.5) {
  return stories.map(story => {
    const expectedTime = storyPointBaselines[story.estimate];
    const actualTime = story.cycleTime;
    const threshold = expectedTime * thresholdMultiplier;
    
    return {
      ...story,
      isBottleneck: actualTime > threshold,
      severityLevel: getSeverityLevel(actualTime, expectedTime),
      delayHours: Math.max(0, actualTime - threshold),
      alertMessage: actualTime > threshold 
        ? `${story.estimate}-point story took ${actualTime}h (expected ~${expectedTime}h)`
        : null
    };
  });
}

function getSeverityLevel(actual, expected) {
  const ratio = actual / expected;
  if (ratio > 3) return "Critical";
  if (ratio > 2) return "High";
  if (ratio > 1.5) return "Medium";
  return "Low";
}
```

**Example Bottleneck Alert**:
```
Story: "Implement user authentication"
Estimate: 2 points
Expected Time: 8 hours
Actual Time: 18 hours
Threshold: 12 hours (8 × 1.5)
Result: BOTTLENECK DETECTED
Severity: High (2.25x over estimate)
Alert: "2-point story took 18h (expected ~8h) - investigate blockers"
```

### Confidence Intervals & Predictive Analytics

**95% Confidence Interval Calculation**:
```typescript
function calculateConfidenceInterval(storyPointData, confidenceLevel = 0.95) {
  const mean = calculateMean(storyPointData);
  const stdDev = calculateStandardDeviation(storyPointData);
  const n = storyPointData.length;
  
  // t-distribution critical value for 95% confidence
  const tValue = getTValue(confidenceLevel, n - 1);
  const marginOfError = tValue * (stdDev / Math.sqrt(n));
  
  return {
    mean,
    lowerBound: mean - marginOfError,
    upperBound: mean + marginOfError,
    standardDeviation: stdDev,
    sampleSize: n
  };
}
```

**Predictive Range Example**:
```
3-Point Stories Analysis:
- Historical Data: [12h, 16h, 14h, 18h, 15h, 20h, 13h]
- Mean: 15.4 hours
- Standard Deviation: 2.8 hours
- 95% Confidence Interval: 12.1 - 18.7 hours
- Prediction: "3-point stories typically take 12-19 hours"
```

This comprehensive calculation methodology ensures complete transparency in how every metric is derived and provides teams with the exact formulas used for their performance analysis.

## 🔧 Project Structure

```
src/
├── components/
│   ├── DORADashboard.tsx      # Main dashboard component
│   ├── MetricCard.tsx         # Reusable metric display
│   ├── LeadTimeAnalysis.tsx   # Lead time insights
│   ├── EstimationAnalysis.tsx # Estimation accuracy
│   ├── CycleDataExplorer.tsx  # Linear cycle analysis
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── doraCalculator.ts      # DORA metrics logic
│   ├── linearApi.ts           # Linear API integration
│   ├── metricDefinitions.ts   # Metric configurations
│   ├── sampleData.ts          # Test data
│   └── timeUtils.ts           # Date/time utilities
└── functions/
    └── linear-proxy/          # Edge function for API calls
        └── index.ts
```

## 🎯 Usage Examples

### Basic Setup
1. Enter Linear API credentials
2. Select time period (7/30/90 days)
3. View DORA metrics in Overview tab
4. Drill down into specific analyses

### Advanced Analytics
1. Navigate to Cycle Time Analysis for detailed breakdowns
2. Use Estimation Analysis to track accuracy trends
3. Set up bottleneck alerts with custom thresholds
4. Export reports for stakeholder reviews

## 📊 Data Export

- **CSV Export**: Raw data for further analysis
- **PDF Reports**: Formatted dashboards for sharing
- **API Integration**: Connect to other tools via Linear API

## 🔒 Security & Privacy

- API keys stored securely in browser localStorage
- No data persistence on servers
- Direct Linear API communication
- Edge functions for secure API proxying

## 🚀 Deployment

### Netlify (Recommended)
1. Connect repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Deploy with edge functions support

### Manual Deployment
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

## 📋 Recent Updates

### v1.3.0 - Cycle Time vs Lead Time Terminology Fix
- **🏷️ Renamed**: "Lead Time" tab renamed to "Cycle Time" to accurately reflect what it measures
- **📊 Clarified**: Cycle Time measures In Progress → Deployed (team execution speed)
- **📊 Distinguished**: Lead Time for Changes (DORA) measures Code Review → Deployed (pipeline efficiency)
- **📚 Updated**: Documentation updated with clear metric definitions and distinctions
- **✅ Enhanced**: Better terminology alignment with industry standards

### v1.2.0 - Lead Time for Changes DORA Compliance Fix
- **🐛 Fixed**: Lead Time for Changes now correctly measures from code commit (Code Review state) to deployment, following DORA standard definition
- **✅ Improved**: Uses Linear status history to find actual "Code Review" state transition timestamp for precise calculation
- **✅ Enhanced**: Fallback to startedAt if no code review transition found in status history
- **📊 Impact**: Lead time now accurately reflects deployment pipeline efficiency from commit to production
- **📚 Updated**: Documentation and metric definitions updated to reflect DORA compliance

### v1.1.0 - Deployment Frequency Rating Fix
- **🐛 Fixed**: Deployment frequency rating calculation bug where cycle-based metrics were incorrectly rated
- **✅ Improved**: Added proper cycle-based rating thresholds (Elite >10, High >5, Medium >1 deployments per cycle)
- **✅ Enhanced**: Maintained accurate daily-rate thresholds for time-based views
- **📊 Impact**: 3 deployments in 10 days now correctly shows as "Low" performance instead of "Elite"

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)
- **Linear API**: [Linear API Docs](https://developers.linear.app/)

## 🎉 Acknowledgments

- [Linear](https://linear.app/) for excellent API documentation
- [DORA Research](https://dora.dev/) for metrics framework
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [Recharts](https://recharts.org/) for data visualization

---

Built with ❤️ using React, TypeScript, and the Linear API