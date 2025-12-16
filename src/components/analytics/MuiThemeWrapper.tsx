import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useTheme } from '@/context/ThemeContext';

// Create MUI theme that respects the app's theme
interface MuiThemeWrapperProps {
  children: React.ReactNode;
  // Explicitly ignore data-lov-* props that may be passed by dev tools
  [key: string]: any;
}

const MuiThemeWrapper: React.FC<MuiThemeWrapperProps> = ({ children }) => {
  const { baseTheme } = useTheme();
  
  const muiTheme = React.useMemo(() => createTheme({
    palette: {
      mode: baseTheme === 'light' ? 'light' : 'dark',
      primary: {
        main: '#e10600', // F1 Red
      },
      background: {
        // Use rgba instead of 'transparent' - MUI DataGrid doesn't support transparent
        default: baseTheme === 'light' ? 'rgba(255,255,255,0.01)' : 'rgba(15,15,20,0.01)',
        paper: baseTheme === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(15,15,20,0.8)',
      },
      text: {
        primary: baseTheme === 'light' ? '#1a1a1a' : '#fafafa',
        secondary: baseTheme === 'light' ? '#666666' : '#a1a1aa',
      },
    },
    typography: {
      fontFamily: 'inherit',
      fontSize: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: baseTheme === 'light' ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)',
          },
        },
      },
      // @ts-ignore - MuiDataGrid types may not be available in all MUI versions
      MuiDataGrid: {
        styleOverrides: {
          root: {
            backgroundColor: 'inherit',
            border: 'none',
          },
        },
      },
    },
  }), [baseTheme]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
};

export default MuiThemeWrapper;
