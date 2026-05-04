const fs = require('fs');
const path = require('path');

// 1. Create src/stores/useAppStore.ts
const storeCode = `import { create } from 'zustand';
import type { TabName } from '../layout/Sidebar';

interface AppStore {
  activeTab: TabName;
  isProcessing: boolean;
  browserContext: string | undefined;
  nexusSystemStatus: string;
  selectedRepos: string[];
  
  setActiveTab: (tab: TabName) => void;
  setIsProcessing: (processing: boolean) => void;
  setBrowserContext: (context: string | undefined) => void;
  setNexusSystemStatus: (status: string) => void;
  setSelectedRepos: (repos: string[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab: 'VibeCoder',
  isProcessing: false,
  browserContext: undefined,
  nexusSystemStatus: 'IDLE',
  selectedRepos: [],
  
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setBrowserContext: (browserContext) => set({ browserContext }),
  setNexusSystemStatus: (nexusSystemStatus) => set({ nexusSystemStatus }),
  setSelectedRepos: (selectedRepos) => set({ selectedRepos }),
}));
`;
fs.writeFileSync('./src/stores/useAppStore.ts', storeCode);

// 2. Read src/App.tsx
let appTsx = fs.readFileSync('./src/App.tsx', 'utf8');

// Update imports
appTsx = appTsx.replace(/from '\.\//g, "from '../");
appTsx = appTsx.replace(/import\('\.\//g, "import('../");
appTsx = appTsx.replace(/import \{ usePipelineStore \}/g, "import { useAppStore } from '../stores/useAppStore';\nimport { usePipelineStore }");

// Replace useState with useAppStore
appTsx = appTsx.replace(/const \[activeTab, setActiveTab\] = useState<TabName>\('VibeCoder'\);/g, 
  "const { activeTab, setActiveTab, isProcessing, setIsProcessing, browserContext, setBrowserContext, nexusSystemStatus, setNexusSystemStatus, selectedRepos, setSelectedRepos } = useAppStore();");

appTsx = appTsx.replace(/const \[isProcessing, setIsProcessing\] = useState\(false\);\n?/g, '');
appTsx = appTsx.replace(/const \[browserContext, setBrowserContext\] = useState<string \| undefined>\(undefined\);\n?/g, '');
appTsx = appTsx.replace(/const \[nexusSystemStatus, setNexusSystemStatus\] = useState\('IDLE'\);\n?/g, '');
appTsx = appTsx.replace(/const \[selectedRepos, setSelectedRepos\] = useState<string\[\]>\(\[\]\);\n?/g, '');

fs.writeFileSync('./src/components/App.tsx', appTsx);
fs.unlinkSync('./src/App.tsx');

// 3. Update main.tsx
let mainTsx = fs.readFileSync('./src/main.tsx', 'utf8');
mainTsx = mainTsx.replace("import App from './App.tsx';", "import App from './components/App';");
fs.writeFileSync('./src/main.tsx', mainTsx);
console.log('Group B task completed');
