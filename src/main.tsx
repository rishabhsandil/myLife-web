import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// Register service worker for PWA caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(console.error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
