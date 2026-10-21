import { useState } from 'react';
import type { ReactNode } from 'react';

interface NavProps {
  route: string;
  navigate: (path: string) => void;
  children?: ReactNode;
}

const NAV_ITEMS = [
  { path: '/guide', label: '使用指南' },
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
        <button className="brand" onClick={() => go('/')} aria-label="ClipText 首页">
          <span className="brand-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <rect x="10" y="16" width="44" height="32" rx="9" stroke="#c95b2a" strokeWidth="5" />
              <circle cx="21" cy="26" r="3.5" fill="#c95b2a" />
              <rect x="30" y="23" width="14" height="5" rx="2.5" fill="#c95b2a" />
              <rect x="17" y="34" width="30" height="3.5" rx="1.75" fill="#1f1b16" />
              <rect x="17" y="41" width="20" height="3.5" rx="1.75" fill="#1f1b16" />
            </svg>
          </span>
          <span>
            <span className="brand-name">ClipText</span>
            <br />
            <span className="brand-sub">短视频解析与文案提取</span>
          </span>
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
