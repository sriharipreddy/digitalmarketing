import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { store } from './store';
import { theme } from './theme';
import App from './App';
import AuthBootstrap from './components/AuthBootstrap';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <BrowserRouter>
            <AuthBootstrap>
              <App />
            </AuthBootstrap>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
