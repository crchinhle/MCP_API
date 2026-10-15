import 'antd/dist/reset.css';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/vietnamese-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/vietnamese-500.css';
import './presentation/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './presentation/app/App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Không tìm thấy phần tử #root để khởi tạo Emukey.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
