# F1 DataStop

<img src="public/lovable-uploads/4b2c0df9-6dc4-4759-bfe3-fb274f378741.png" alt="F1 DataStop" width="250" height="200">
A modern React application for Formula 1 enthusiasts providing real-time race data, lap time analysis, position tracking, and comprehensive F1 insights.

## Overview

F1 DataStop is a data-rich analytics platform for Formula 1 fans that visualizes race performance, lap times, position changes, and other critical race metrics. The application uses the latest F1 data to deliver insights through interactive charts and immersive visualizations.

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui components
- **Styling**: Tailwind CSS
- **State Management**: React Query, Context API
- **Routing**: React Router
- **Data Visualization**: Recharts
- **Backend**: Supabase
- **Maps**: Mapbox GL
- **3D Globe**: Three.js, Three-Globe

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Supabase account (for database functionality)

### Installation

1. Clone the repository:
```sh
git clone https://github.com/yourusername/f1datastop.git
cd f1datastop
```

2. Install dependencies:
```sh
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```sh
npm run dev
```

The app will be available at `http://localhost:8080`.

## Supabase Integration

F1 DataStop uses Supabase for data storage, authentication, and real-time updates.

### Data Model

The application relies on several Supabase tables:
- `races`: Information about F1 races
- `drivers`: Driver information and statistics
- `teams`: Team data
- `lap_times`: Detailed lap time data
- `position_data`: Race position tracking
- `users`: User accounts and preferences

### Authentication

The app implements Supabase authentication through the `AuthContext` provider:
- Email/password login
- Social login options
- JWT token management
- Protected routes

### Connecting to Supabase

The connection is managed in `src/integrations/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Key Components

### Analytics Components

- **LapTimeChart**: Visualizes lap times for selected drivers
- **PositionChangeChart**: Tracks position changes throughout a race
- **DriverSelector**: Interactive component for selecting drivers to analyze
- **DisplayModeToggle**: Toggles between absolute and gap time displays

### Layout Components

- **MainLayout**: Primary layout with navigation and content areas
- **SideNav**: Navigation sidebar with links to different sections
- **Header**: App header with authentication and user controls

### Authentication Components

- **ProtectedRoute**: Route wrapper that requires authentication
- **LoginForm**: User login interface
- **SignupForm**: New user registration

## Project Structure

```
f1datastop/
├── public/                  # Static assets
├── src/
│   ├── assets/              # Application assets
│   │   ├── analytics/       # Data visualization components
│   │   ├── auth/            # Authentication components
│   │   ├── layout/          # Layout components
│   │   └── ui/              # shadcn UI components
│   ├── constants/           # Application constants
│   ├── context/             # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # Third-party integrations
│   ├── lib/                 # Utility libraries
│   ├── pages/               # Page components
│   ├── services/            # API services
│   └── utils/               # Utility functions
├── supabase/                # Supabase configuration
│   └── functions/           # Supabase Edge Functions
└── ...
```

## Development Guidelines

### Adding New Components

1. Create the component in the appropriate directory
2. Use TypeScript interfaces for props
3. Follow the established styling patterns with Tailwind CSS
4. Import from shadcn/ui for consistent design

### Data Fetching Pattern

The application uses React Query and custom hooks for data fetching:

```typescript
// Example hook for fetching race data
export const useRaceData = (year: number, round: string) => {
  return useQuery(['race', year, round], () => 
    fetchRaceData(year, round)
  );
};
```

## Deployment

### Building for Production

```sh
npm run build
```

The production-ready files will be in the `dist` directory.

### Hosting

The application is deployed on Lovable's hosting platform. To deploy:

1. Visit the [Lovable Project](https://lovable.dev/projects/824fa660-781a-4224-acb7-e9b726fb6efa)
2. Navigate to Share -> Publish

For custom domain deployment, follow the Netlify instructions in the [Lovable docs](https://docs.lovable.dev/tips-tricks/custom-domain/).

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments 

- Formula 1 for the inspiration and data
- The shadcn/ui team for the component library
- Lovable for the hosting platform
