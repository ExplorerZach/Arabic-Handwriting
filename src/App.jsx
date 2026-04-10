import { useState } from 'react';
import PracticeView from './components/PracticeView';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('openrouter_key') || ''
  );

  const handleSave = (key) => {
    localStorage.setItem('openrouter_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('openrouter_key');
    setApiKey('');
  };

  return apiKey ? (
    <PracticeView apiKey={apiKey} onClearKey={handleClearKey} />
  ) : (
    <LoginScreen onSave={handleSave} />
  );
}
