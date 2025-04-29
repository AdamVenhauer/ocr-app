import React from 'react';
import OCRApp from './components/OCRApp';

function App() {  
  const menuStyle = {
    backgroundColor: '#f0f0f0',
    padding: '10px',
    marginBottom: '20px',
  };
  
  return (
    <div>
      <div style={menuStyle}>
        <a href="/">Home</a> | <a href="/about">About</a>
      </div>
      <div>
        <OCRApp />
      </div>
    </div>
  );
}
export default App;
