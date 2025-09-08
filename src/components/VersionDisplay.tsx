import React from 'react';

interface VersionDisplayProps {
  className?: string;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ className = '' }) => {
  // Get version from Vite environment variable
  const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
  
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      v{version}
    </div>
  );
};

export default VersionDisplay;
