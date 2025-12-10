import '../src/style.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppIcon } from '../src/ui/components/common/AppIcon';
import { GameLogo } from '../src/ui/components/common/GameLogo';

// Ensure transparent background
if (typeof document !== 'undefined') {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

// Get component type from URL parameter
const params = new URLSearchParams(window.location.search);
const componentType = params.get('component') as 'logo' | 'appicon' | null;

console.log('URL params:', window.location.search);
console.log('Rendering component:', componentType);

if (!componentType) {
  throw new Error('Missing component parameter in URL');
}

if (componentType !== 'logo' && componentType !== 'appicon') {
  throw new Error(`Invalid component type: ${componentType}`);
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

// Render the appropriate component
if (componentType === 'logo') {
  createRoot(root).render(
    <StrictMode>
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
        <GameLogo />
      </div>
    </StrictMode>
  );
} else {
  createRoot(root).render(
    <StrictMode>
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
        <AppIcon />
      </div>
    </StrictMode>
  );
}
