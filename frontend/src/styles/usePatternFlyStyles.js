import { useEffect, useRef } from 'react';

export const usePatternFlyStyles = () => {
  const linkRef = useRef(null);
  const customLinkRef = useRef(null);

  useEffect(() => {
    if (!document.querySelector('[data-patternfly-styles]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/@patternfly/patternfly@6/patternfly.css';
      link.setAttribute('data-patternfly-styles', 'true');
      
      link.onload = () => {
        // Load your custom CSS AFTER PatternFly loads
        const customLink = document.createElement('link');
        customLink.rel = 'stylesheet';
        customLink.href = '/src/styles/patternfly.module.css'; // Adjust path as needed
        customLink.setAttribute('data-custom-patternfly-styles', 'true');
        document.head.appendChild(customLink);
        customLinkRef.current = customLink;
      };
      
      document.head.appendChild(link);
      linkRef.current = link;

      return () => {
        if (linkRef.current && document.head.contains(linkRef.current)) {
          document.head.removeChild(linkRef.current);
        }
        if (customLinkRef.current && document.head.contains(customLinkRef.current)) {
          document.head.removeChild(customLinkRef.current);
        }
      };
    }
  }, []);
};