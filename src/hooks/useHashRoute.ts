import { useEffect, useState } from 'react';

/**
 * 极简 Hash 路由（useHashRoute）
 * GitHub Pages 子路径部署下避免刷新 404；无需额外依赖。
 */

export function useHashRoute(): { route: string; navigate: (path: string) => void } {
  const getRoute = (): string => {
    const h = window.location.hash.replace(/^#/, '');
    return h || '/';
  };
  const [route, setRoute] = useState<string>(getRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path.startsWith('/') ? path : '/' + path;
    setRoute(path.startsWith('/') ? path : '/' + path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { route, navigate };
}

export function routeOf(path: string): string {
  return path.split('?')[0];
}
