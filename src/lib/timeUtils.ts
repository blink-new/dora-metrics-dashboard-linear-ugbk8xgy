/**
 * Time utilities for DORA metrics calculations
 * Handles business hours calculations excluding weekends
 */

/**
 * Calculate business hours between two dates, excluding weekends
 * Assumes business hours are 9 AM to 5 PM (8 hours per day)
 */
export function calculateBusinessHours(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let totalHours = 0;
  const current = new Date(start);
  
  while (current < end) {
    const dayOfWeek = current.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dayStart = new Date(current);
      dayStart.setHours(9, 0, 0, 0); // 9 AM
      
      const dayEnd = new Date(current);
      dayEnd.setHours(17, 0, 0, 0); // 5 PM
      
      const periodStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
      const periodEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));
      
      if (periodStart < periodEnd) {
        totalHours += (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
      }
    }
    
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  return totalHours;
}

/**
 * Format business hours into a readable format
 * When > 24 hours, express as days and hours
 */
export function formatBusinessDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  
  if (hours < 24) {
    return `${Math.round(hours * 10) / 10}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round((hours % 24) * 10) / 10;
  
  if (remainingHours === 0) {
    return `${days}d`;
  }
  
  return `${days}d ${remainingHours}h`;
}

/**
 * Convert business hours to business days (8 hours = 1 business day)
 */
export function businessHoursToDays(hours: number): number {
  return Math.round((hours / 8) * 10) / 10;
}