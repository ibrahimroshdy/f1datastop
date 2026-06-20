# F1 DataStop

<p align="center">
<img src="web/public/lovable-uploads/f1-cover-v2.jpg" alt="F1 DataStop" width="250" height="200">
</p>

<p align="center">
  <strong>The Ultimate Formula 1 Data Analytics Platform</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#data-sources">Data Sources</a> •
  <a href="#analytics">Analytics</a> •
  <a href="#contributing">Contributing</a>
</p>

---

A modern, responsive React application for Formula 1 enthusiasts providing real-time race data, lap time analysis, position tracking, championship standings, and comprehensive F1 insights. Built with shadcn/ui components for a beautiful, unified user experience.

## Features

### Dashboard
- **Live Race Tracking** - Real-time position updates during races
- **Championship Standings** - Driver and Constructor standings with points progression
- **Last Race Results** - Quick overview of the most recent race results
- **Next Race Countdown** - Countdown to the upcoming race with circuit information
- **Season Overview** - Comprehensive view of the current F1 season

### Analytics
- **Lap Time Analysis** - Compare lap times across drivers with gap mode
- **Position Changes** - Track position changes throughout races
- **Qualifying Analysis** - Detailed qualifying session breakdowns
- **Pit Stop Analysis** - Pit stop timing and strategy visualization
- **Year-over-Year Comparisons** - Compare performance across seasons

### Interactive Features
- **F1 Trivia** - Test your F1 knowledge with timed quizzes
- **Race Calendar** - Full season calendar with race details and infographics
- **Driver & Constructor Profiles** - Detailed information for all teams and drivers
- **Embeddable Widgets** - Share standings on your own website

### Design System
- **Dark/Light Mode** - Full theme support
- **Mobile Responsive** - Optimized for all screen sizes
- **F1 Branding** - Authentic F1 red (#e10600) color scheme
- **shadcn/ui Components** - Beautiful, accessible UI components

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript |
| **Build Tool** | Vite |
| **UI Framework** | [shadcn/ui](https://ui.shadcn.com/) |
| **Styling** | Tailwind CSS |
| **State Management** | React Query, Context API |
| **Routing** | React Router v6 |
| **Data Visualization** | Recharts, D3.js |
| **Backend/Auth** | Supabase |
| **Maps** | Mapbox GL |
| **3D Globe** | Three.js, Three-Globe |
| **Analytics** | Google Analytics 4, Microsoft Clarity |

## Data Sources

F1 DataStop uses **two complementary data sources** for comprehensive coverage:

### Jolpica/Ergast API (Historical Data)
- **Base URL**: `https://api.jolpi.ca/ergast/f1/`
- **Documentation**: [Jolpica F1 API](https://github.com/jolpica/jolpica-f1)
- **Data**: Standings, results, qualifying, lap times, pit stops, race schedules
- **Usage**: Primary data source for all historical and race-by-race data

### OpenF1 API (Live Data)
- **Base URL**: `https://api.openf1.org/v1/`
- **Documentation**: [OpenF1 API](https://openf1.org/)
- **Data**: Live timing, telemetry, weather, team radio, session data
- **Usage**: Real-time data during race weekends

> **IMPORTANT**: All team and driver data is fetched **dynamically** from the APIs. No static team lists or driver configurations are hardcoded, ensuring the app automatically supports any number of teams (10, 11, or more) and drivers (20, 22, or more) for future seasons.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Supabase account (for authentication and trivia features)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/f1datastop.git
cd f1datastop
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Analytics (Optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Microsoft Clarity (Optional)
VITE_CLARITY_PROJECT_ID=your_clarity_project_id

# Mapbox (Optional - for maps)
VITE_MAPBOX_TOKEN=your_mapbox_token
```

4. **Start the development server**
```bash
npm run dev
```

The app will be available at `http://localhost:8080`.

## Analytics Integration

### Google Analytics 4

F1 DataStop integrates Google Analytics for tracking:
- Page views and navigation
- User engagement metrics
- Feature usage analytics
- Error tracking

The integration is handled by `src/integrations/google-analytics/AnalyticsProvider.tsx`.

### Microsoft Clarity

Session recording and heatmaps are provided by Microsoft Clarity:
- User session recordings
- Click heatmaps
- Scroll depth tracking
- Rage click detection

The integration is handled by `src/integrations/clarity/ClarityProvider.tsx`.

## Authentication

F1 DataStop uses **Supabase** for authentication:

- **Email/Password** - Standard email authentication
- **Twitter/X OAuth** - Social login with Twitter
- **Profile Management** - User profiles with customizable usernames
- **Protected Routes** - Trivia and profile features require authentication

### Setting Up Twitter OAuth

1. Create a Twitter Developer account
2. Set up an OAuth 2.0 app
3. Add the callback URL: `https://your-supabase-url.supabase.co/auth/v1/callback`
4. Configure in Supabase Dashboard → Authentication → Providers → Twitter

## Project Structure

```
f1datastop/
├── public/                     # Static assets
├── src/
│   ├── components/
│   │   ├── analytics/          # Chart and data visualization components
│   │   ├── calendar/           # Race calendar components
│   │   ├── charts/             # F1 chart system (F1ChartCard, etc.)
│   │   ├── common/             # Shared components (CountryFlag, TeamLogo)
│   │   ├── dashboard/          # Dashboard cards and widgets
│   │   ├── embeddable/         # Embeddable widget components
│   │   ├── f1/                 # F1 component library (F1Card, F1Badge, etc.)
│   │   ├── layout/             # Layout components (MainLayout, Sidebar)
│   │   ├── trivia/             # Trivia game components
│   │   └── ui/                 # shadcn/ui components
│   ├── constants/              # F1 colors, configuration
│   ├── context/                # React context providers
│   │   └── auth/               # Authentication context
│   ├── hooks/                  # Custom React hooks
│   ├── integrations/           # Third-party integrations
│   │   ├── clarity/            # Microsoft Clarity
│   │   ├── google-analytics/   # GA4 integration
│   │   └── supabase/           # Supabase client
│   ├── pages/                  # Page components
│   ├── services/               # API services
│   │   ├── f1Service.ts        # Ergast/Jolpica API
│   │   ├── openF1Service.ts    # OpenF1 API
│   │   └── triviaService.ts    # Trivia game service
│   └── utils/                  # Utility functions
├── supabase/                   # Supabase configuration
│   └── functions/              # Edge Functions
└── ...
```

## F1 Component Library

F1 DataStop includes a custom component library built on shadcn/ui:

### Core Components (`src/components/f1/`)
- `F1Card` - Racing-styled card with team color accents
- `F1Badge` - Position badges, status indicators
- `F1Avatar` - Driver/team avatars with team colors
- `F1Progress` - Points progress bars with team gradients
- `F1Skeleton` - F1-themed loading skeletons
- `F1EmptyState` - Beautiful empty states with F1 imagery
- `F1ErrorState` - Friendly error states with retry

### Chart Components (`src/components/charts/`)
- `F1ChartCard` - Chart wrapper with loading/empty/error states
- `F1ChartTooltip` - Unified tooltip styling
- `F1ChartLegend` - Responsive legend component
- `F1ChartEmpty` - Chart-specific empty states
- `F1ChartLoading` - Chart skeleton loaders

## Embeddable Widgets

F1 DataStop provides embeddable widgets for external use:

### Driver Standings
```html
<iframe 
  src="https://f1datastop.com/embed/driver-standings?season=2024&theme=dark" 
  width="400" 
  height="600"
></iframe>
```

### Constructor Standings
```html
<iframe 
  src="https://f1datastop.com/embed/constructor-standings?season=2024&theme=light" 
  width="400" 
  height="400"
></iframe>
```

**URL Parameters:**
- `season` - Year (default: current year)
- `theme` - `light` or `dark`
- `font` - Custom font family

## Support the Project

If you enjoy F1 DataStop, consider supporting the project:

<a href="https://www.buymeacoffee.com/f1datastop" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" height="50">
</a>

## Development Guidelines

### Adding New Components

1. Create the component in the appropriate directory
2. Use TypeScript interfaces for props
3. Follow the established styling patterns with Tailwind CSS
4. Import from shadcn/ui or the F1 component library
5. Ensure mobile responsiveness

### Data Fetching Pattern

```typescript
// Use React Query hooks from useF1Data.ts
import { useDriverStandings, useRaceSchedule } from "@/hooks/useF1Data";

// For team/driver metadata with colors
import { useF1Metadata } from "@/hooks/useF1Metadata";

const MyComponent = () => {
  const { drivers, teams, getTeamColor } = useF1Metadata();
  const { data: standings, isLoading } = useDriverStandings();
  
  // Use the data...
};
```

### Theme Support

All components support light and dark themes via CSS variables:

```css
/* Use semantic color variables */
.my-component {
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  border-color: hsl(var(--border));
}
```

## Deployment

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

### Hosting

The application can be deployed to:
- **Vercel** - Recommended for React apps
- **Netlify** - Easy deployment with Git integration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns
- Use shadcn/ui components where possible
- Ensure mobile responsiveness
- Add appropriate loading and error states

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments 

- **Formula 1** - For the inspiration and amazing sport
- **Jolpica F1 API** - Historical F1 data
- **OpenF1** - Live timing data
- **shadcn/ui** - Beautiful component library
- **Recharts** - Data visualization
- **Supabase** - Backend and authentication

---

<p align="center">
  Made with ❤️ for F1 fans everywhere
</p>
