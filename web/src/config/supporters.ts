// Configuration for Buy Me a Coffee supporters
// Update this number when you get new supporters!

export const SUPPORTER_CONFIG = {
  count: 2, // Update this number when you get new supporters
  lastUpdated: '2024-01-15', // Keep track of when you last updated
  
  // Optional: Add supporter milestones for future features
  milestones: {
    5: 'Add new F1 data features',
    10: 'Premium dashboard themes',
    25: 'Real-time race notifications',
    50: 'Mobile app development'
  }
};

// Helper function to get current supporter count
export const getSupporterCount = (): number => {
  return SUPPORTER_CONFIG.count;
};

// Helper function to get next milestone
export const getNextMilestone = (): { count: number; reward: string } | null => {
  const currentCount = SUPPORTER_CONFIG.count;
  const milestones = Object.entries(SUPPORTER_CONFIG.milestones)
    .map(([count, reward]) => ({ count: parseInt(count), reward }))
    .sort((a, b) => a.count - b.count);
  
  const nextMilestone = milestones.find(milestone => milestone.count > currentCount);
  return nextMilestone || null;
}; 