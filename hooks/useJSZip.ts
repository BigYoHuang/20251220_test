import { useState, useEffect } from 'react';

const useJSZip = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.JSZip) {
      setIsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
  }, []);

  return isLoaded;
};

export default useJSZip;