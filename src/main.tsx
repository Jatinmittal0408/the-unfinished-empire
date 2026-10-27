import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './styles.css';
import { App } from './App';
import { applyEditOverride } from './media/scenes';

// comparison harness: ?edit=eg:cut|dissolve|threshold,gc:… selects the edit style of each join
applyEditOverride(location.search);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
