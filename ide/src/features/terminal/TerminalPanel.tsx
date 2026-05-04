import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Maximize2, Minimize2 } from 'lucide-react';

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      rows: 15,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Welcome message
    term.writeln('\x1b[1;32mNexus Alpha Terminal\x1b[0m');
    term.writeln('Type "help" for available commands.');
    term.writeln('');
    term.write('\x1b[1;34m$\x1b[0m ');

    let commandBuffer = '';
    term.onKey(({ key, domEvent }) => {
      domEvent.preventDefault();
      if (key === 'Enter') {
        term.writeln('');
        handleCommand(commandBuffer, term);
        commandBuffer = '';
        term.write('\x1b[1;34m$\x1b[0m ');
      } else if (key === 'Backspace') {
        if (commandBuffer.length > 0) {
          commandBuffer = commandBuffer.slice(0, -1);
          term.write('\b \b');
        }
      } else if (key.length === 1) {
        commandBuffer += key;
        term.write(key);
      }
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  const handleCommand = (cmd: string, term: Terminal) => {
    const commands: Record<string, () => void> = {
      help: () => {
        term.writeln('Available commands:');
        term.writeln('  \x1b[1;33mhelp\x1b[0m - Show this help');
        term.writeln('  \x1b[1;33mclear\x1b[0m - Clear terminal');
        term.writeln('  \x1b[1;33mdate\x1b[0m - Show current date');
        term.writeln('  \x1b[1;33mwhoami\x1b[0m - Show current user');
        term.writeln('  \x1b[1;33mecho\x1b[0m <text> - Print text');
      },
      clear: () => term.clear(),
      date: () => term.writeln(new Date().toLocaleString()),
      whoami: () => term.writeln('nexus-user'),
    };

    if (cmd.trim() in commands) {
      commands[cmd.trim()]();
    } else if (cmd.startsWith('echo ')) {
      term.writeln(cmd.slice(5));
    } else if (cmd.trim()) {
      term.writeln(`\x1b[31mCommand not found: ${cmd}\x1b[0m`);
    }
  };

  const handleClear = () => {
    termRef.current?.clear();
    termRef.current?.write('\x1b[1;34m$\x1b[0m ');
  };

  return (
    <div className={`flex flex-col bg-[#1e1e1e] ${isMaximized ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-gray-800">
        <span className="text-xs text-gray-400">Terminal</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="px-2 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-0.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-1" />
    </div>
  );
}
