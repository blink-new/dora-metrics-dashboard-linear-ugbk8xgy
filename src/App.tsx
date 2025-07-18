import DORADashboard from './components/DORADashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <DORADashboard />
    </ErrorBoundary>
  );
}

export default App;