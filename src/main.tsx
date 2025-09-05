import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { fixPetDataInStorage } from '@/utils/uuidFixer'
import { setupAutoSync } from '@/services/kikisync'

// Unregister service worker in dev
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
}

// Fix invalid pet IDs before app starts
fixPetDataInStorage();

// Setup auto-sync for coins and other changes
setupAutoSync();

createRoot(document.getElementById("root")!).render(<App />);
