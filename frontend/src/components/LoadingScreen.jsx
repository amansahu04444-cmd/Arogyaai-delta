import React from 'react';

const LoadingScreen = () => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#0a0a0a',
      color: 'white'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #ff385c',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LoadingScreen;
