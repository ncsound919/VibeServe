import React from 'react';

interface AppProps {
  description?: string;
}

export const App: React.FC<AppProps> = ({ description }) => {
  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Nexus Generated App</h1>
      {description && (
        <p style={{ color: '#555', borderLeft: '4px solid #646cff', paddingLeft: '12px' }}>
          {description}
        </p>
      )}
    </div>
  );
};