import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useTheme } from '@/context/ThemeContext';

// Create MUI theme that respects the app's theme
const MuiThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { baseTheme } = useTheme();
  
  const muiTheme = React.useMemo(() => createTheme({
    palette: {
      mode: baseTheme === 'light' ? 'light' : 'dark',
      primary: {
        main: '#e10600', // F1 Red
      },
      background: {
        default: 'transparent',
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
            backgroundColor: 'transparent',
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

