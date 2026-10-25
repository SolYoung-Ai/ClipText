import { useState } from 'react';
import type { ReactNode } from 'react';

interface NavProps {
  route: string;
  navigate: (path: string) => void;
  children?: ReactNode;
}

const NAV_ITEMS = [
  { path: '/platforms', label: '支持平台' },
  { path: '/history', label: '历史记录' },
  { path: '/settings', label: '设置' },
];

export function TopNav({ route, navigate }: NavProps) {
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <button className="brand" onClick={() => go('/')} aria-label="SolClip 首页" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <img src="./logo.svg" alt="SolClip" height="28" style={{ display: 'block' }} />
        </button>

        <nav className="nav-links" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`nav-link ${route === item.path ? 'active' : ''}`}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          className="menu-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="展开菜单"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      <nav className={`mobile-menu ${open ? 'open' : ''}`} aria-label="移动端导航">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`nav-link ${route === item.path ? 'active' : ''}`}
            onClick={() => go(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
