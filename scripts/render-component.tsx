import '../src/style.css';

import { type ReactNode, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { GameLogo } from '../src/ui/components/common/GameLogo';

// Ensure transparent background
if (typeof document !== 'undefined') {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

// Get component type from URL parameter
const params = new URLSearchParams(window.location.search);
const componentType = params.get('component');

console.log('URL params:', window.location.search);
console.log('Rendering component:', componentType);

if (componentType !== 'logo') {
  throw new Error(`Invalid or missing component type: ${componentType}. Only 'logo' is supported.`);
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

const ReadyContainer = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const container = document.getElementById('logo-container');
    if (container) {
      container.setAttribute('data-render-ready', 'true');
    }
  }, []);

  return (
    <div
      id="logo-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'transparent',
      }}
    >
      {children}
    </div>
  );
};

createRoot(root).render(
  <StrictMode>
    <ReadyContainer>
      <GameLogo />
    </ReadyContainer>
  </StrictMode>
);
