import { useCallback, useState } from 'react';
import { ToastProvider } from './components/Toast';
import { TopNav } from './components/TopNav';
import { useHashRoute } from './hooks/useHashRoute';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { PlatformsPage } from './pages/PlatformsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const { route, navigate } = useHashRoute();
  const [prefill, setPrefill] = useState<string>('');

  const openLinkFromHistory = useCallback(
    (url: string) => {
      setPrefill(url);
      navigate('/');
    },
    [navigate],
  );

  const consumePrefill = useCallback((): string => {
    const v = prefill;
    if (v) setPrefill('');
    return v;
  }, [prefill]);

  return (
    <ToastProvider>
      <TopNav route={route} navigate={navigate} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {route === '/settings' ? (
          <SettingsPage />
        ) : route === '/history' ? (
          <HistoryPage onOpenLink={openLinkFromHistory} />
        ) : route === '/platforms' ? (
          <PlatformsPage />
        ) : (
          <HomePage key={prefill || 'home'} initialLink={consumePrefill()} />
        )}
      </div>
      <footer className="footer">
        <div className="container">
          SolClip · 短视频解析与文案提取
          <br />
          <a href="#/platforms">支持平台</a> · <a href="#/settings">设置</a> · 请仅处理你有权访问的内容，遵守平台规则与版权要求
        </div>
      </footer>
    </ToastProvider>
  );
}
