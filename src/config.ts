export interface Config {
  SEASON_ID: string;
  GAS_URL: string;
  TEAM_IDS: { id: string; name: string }[];
  OFFLINE_CATEGORIES: string[];
  ADMIN_EMAILS: string[];
  ALLOWED_STUDENT_DOMAINS: string[];
}

export const AppConfig: Config = {
  SEASON_ID: '2024-25',
  GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  TEAM_IDS: [
    { id: 'GP', name: 'Giggle Pickles' },
    { id: 'BH', name: 'Blockheads' },
  ],
  OFFLINE_CATEGORIES: ['CAD', 'Programming', 'Documentation', 'Outreach', 'Other'],
  ADMIN_EMAILS: ['coach@example.com'],
  ALLOWED_STUDENT_DOMAINS: ['example.com'],
};
