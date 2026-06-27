"""MockProvider, SamplingProvider, and shared helpers."""
from __future__ import annotations

import asyncio
import json as _json
import logging
import os
from typing import Any, Optional

from vibeserve.providers.base import LLMProvider

log = logging.getLogger("VibeServe")


class SamplingProvider(LLMProvider):
    def __init__(self, ctx: Any = None):
        self._ctx = ctx
        self._active = ctx is not None and hasattr(ctx, 'sample')

    @property
    def name(self) -> str:
        return "MCP-Sampling"

    def bind(self, ctx: Any):
        self._ctx = ctx
        self._active = ctx is not None and hasattr(ctx, 'sample')

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json", timeout: float = 30.0) -> Optional[str]:
        if not self._active or not self._ctx:
            return None
        try:
            result = await asyncio.wait_for(
                self._ctx.sample(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=4096
                ),
                timeout=timeout,
            )
            if hasattr(result, 'text'):
                return result.text
            if hasattr(result, 'content'):
                return str(result.content)
            return str(result) if result else None
        except asyncio.TimeoutError:
            log.warning(f"[MCP-Sampling] Sample call timed out after {timeout}s")
            return None
        except Exception as e:
            log.warning(f"[MCP-Sampling] Sample call failed: {e}")
            return None


class MockProvider(LLMProvider):
    """Deterministic provider that returns canned JSON. Used for testing and
    for environments without a real LLM. Returns a fixed review result so
    downstream code paths can be exercised end-to-end.

    Set VIBESERVE_MOCK_INTELLIGENCE=true to enable keyword-driven mock that
    detects common code-review patterns in the prompt and returns realistic
    findings. This is useful for benchmarking the harness without spending
    on a real LLM.

    Code-generation prompts (asking for React components, hooks, utilities)
    return realistic, compilable TypeScript so the codegen-benchmark can
    exercise its full verification pipeline.
    """

    CODE_GEN_TEMPLATES = [
        ("React counter component", _json.dumps([{
            "path": "Counter.tsx", "language": "tsx",
            "content": """import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  min?: number;
  max?: number;
}

const Counter: React.FC<CounterProps> = ({
  initialValue = 0,
  min = -Infinity,
  max = Infinity,
}) => {
  const [count, setCount] = useState<number>(initialValue);

  const increment = (): void => {
    setCount((prev) => Math.min(prev + 1, max));
  };

  const decrement = (): void => {
    setCount((prev) => Math.max(prev - 1, min));
  };

  const reset = (): void => {
    setCount(initialValue);
  };

  return (
    <div className="counter" role="group" aria-label="counter controls">
      <h2>Count: {count}</h2>
      <button onClick={increment} aria-label="increment">+</button>
      <button onClick={decrement} aria-label="decrement">-</button>
      <button onClick={reset} aria-label="reset">Reset</button>
    </div>
  );
};

export default Counter;""",
            "purpose": "React counter component with increment, decrement, and reset",
        }]),
        ),
        ("login form", _json.dumps([{
            "path": "LoginForm.tsx", "language": "tsx",
            "content": """import React, { useState, useCallback } from 'react';

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  const validate = useCallback((): boolean => {
    const e: FormErrors = {};
    if (!EMAIL_REGEX.test(email)) e.email = 'Invalid email format';
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      setErrors({ email: 'Login failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="login form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && <span id="email-error" role="alert">{errors.email}</span>}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && <span id="password-error" role="alert">{errors.password}</span>}
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

export default LoginForm;""",
            "purpose": "Login form with validation and error display",
        }]),
        ),
        ("useFetch", _json.dumps([{
            "path": "useFetch.ts", "language": "ts",
            "content": """import { useState, useEffect, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T = unknown>(url: string, options?: RequestInit): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null, loading: true, error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = (await res.json()) as T;
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ data: null, loading: false, error: message });
      }
    };

    fetchData();
    return () => controller.abort();
  }, [url]);

  return state;
}

export { useFetch };""",
            "purpose": "Generic useFetch hook with AbortController support",
        }]),
        ),
        ("TASK", _json.dumps([{
            "path": "TASKApp.tsx", "language": "tsx",
            "content": """import React, { useReducer, useState } from 'react';

type Filter = 'all' | 'active' | 'completed';

interface TASK {
  id: number;
  text: string;
  completed: boolean;
}

type Action =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: number }
  | { type: 'DELETE'; id: number };

function TASKReducer(state: TASK[], action: Action): TASK[] {
  switch (action.type) {
    case 'ADD':
      return [...state, { id: Date.now(), text: action.text, completed: false }];
    case 'TOGGLE':
      return state.map((t) => t.id === action.id ? { ...t, completed: !t.completed } : t);
    case 'DELETE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

const TASKApp: React.FC = () => {
  const [TASKS, dispatch] = useReducer(TASKReducer, []);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const addTASK = (): void => {
    if (text.trim()) { dispatch({ type: 'ADD', text: text.trim() }); setText(''); }
  };

  const filtered = TASKS.filter((t) => filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed);

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTASK()} />
      <button onClick={addTASK}>Add</button>
      <div>
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('completed')}>Completed</button>
      </div>
      <ul>
        {filtered.map((t) => (
          <li key={t.id}>
            <input type="checkbox" checked={t.completed} onChange={() => dispatch({ type: 'TOGGLE', id: t.id })} />
            <span style={{ textDecoration: t.completed ? 'line-through' : 'none' }}>{t.text}</span>
            <button onClick={() => dispatch({ type: 'DELETE', id: t.id })}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TASKApp;""",
            "purpose": "TASK manager with useReducer, add/toggle/delete/filter",
        }]),
        ),
        ("middleware", _json.dumps([{
            "path": "authMiddleware.ts", "language": "ts",
            "content": """import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  apiKey?: string;
}

function authMiddleware(validKeys: string[] = []): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const key = authHeader.slice(7);
    if (!validKeys.includes(key)) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    req.apiKey = key;
    next();
  };
}

export { authMiddleware, AuthRequest };""",
            "purpose": "Express middleware for API key validation",
        }]),
        ),
        ("debounce", _json.dumps([{
            "path": "debounce.ts", "language": "ts",
            "content": """// Generic debounce utility — works with arbitrary function signature
type Fn<T extends unknown[]> = (...args: T) => void;

interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
}

function debounce<T extends unknown[]>(
  fn: Fn<T>,
  delayMs: number,
  options: DebounceOptions = {},
): Fn<T> & { cancel: () => void } {
  const { leading = false, trailing = true } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;

  const cancel = (): void => {
    if (timer !== null) { clearTimeout(timer); timer = null; lastArgs = null; }
  };

  const debounced = (...args: T): void => {
    lastArgs = args;
    if (leading && timer === null) {
      fn(...args);
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      if (trailing && lastArgs) fn(...lastArgs);
      timer = null;
      lastArgs = null;
    }, delayMs);
  };

  debounced.cancel = cancel;
  return debounced;
}

export { debounce };""",
            "purpose": "Generic debounce utility with leading/trailing options",
        }]),
        ),
    ]

    INTELLIGENT_PATTERNS = [
        ("new Function(", {"category": "security", "severity": "critical", "type": "code-injection",
         "description": "new Function() compiles and executes arbitrary code from a string",
         "recommendation": "Use a static function or sandboxed VM"}),
        ("eval(", {"category": "security", "severity": "critical", "type": "code-injection",
         "description": "eval() executes arbitrary code from a string",
         "recommendation": "Replace with a safe parser"}),
        ("WHERE name = '", {"category": "security", "severity": "critical", "type": "sql-injection",
         "description": "String interpolation in SQL query — injection vector",
         "recommendation": "Use parameterised query"}),
        ("query(\"SELECT", {"category": "security", "severity": "critical", "type": "sql-injection",
         "description": "String concatenation in SQL — injection vector",
         "recommendation": "Use parameterised query with placeholders"}),
        ("query('SELECT", {"category": "security", "severity": "high", "type": "sql-injection",
         "description": "Parameterised query — appears safe",
         "recommendation": "Continue using parameterised queries"}),
        ("res.send(`<", {"category": "security", "severity": "high", "type": "xss",
         "description": "Unsanitized input rendered in HTML",
         "recommendation": "Use a templating engine with auto-escaping"}),
        ("readFileSync(req", {"category": "security", "severity": "high", "type": "path-traversal",
         "description": "User-controlled path joined to read — traversal risk",
         "recommendation": "Validate resolved path stays inside the intended root"}),
        ("for (const key of Object.keys", {"category": "security", "severity": "high", "type": "prototype-pollution",
         "description": "Recursive merge without __proto__ guard",
         "recommendation": "Filter dangerous keys; use Object.create(null)"}),
        ("md5", {"category": "security", "severity": "medium", "type": "weak-crypto",
         "description": "MD5 is cryptographically broken",
         "recommendation": "Use SHA-256, bcrypt, or argon2"}),
        ("sha1", {"category": "security", "severity": "medium", "type": "weak-crypto",
         "description": "SHA-1 is deprecated for security use",
         "recommendation": "Use SHA-256 or SHA-3"}),
        ("Math.random", {"category": "security", "severity": "medium", "type": "insecure-random",
         "description": "Math.random is not cryptographically secure for tokens",
         "recommendation": "Use crypto.randomBytes or secrets module"}),
        ("jwt.verify(token, '", {"category": "security", "severity": "critical", "type": "jwt-alg-none",
         "description": "jwt.verify without algorithms option allows alg=none attack",
         "recommendation": "Pass algorithms whitelist as third argument"}),
        ("([a-zA-Z]+)+@", {"category": "security", "severity": "high", "type": "redos",
         "description": "Nested quantifier pattern — ReDoS risk",
         "recommendation": "Refactor regex to avoid catastrophic backtracking"}),
        ("sk-proj-", {"category": "security", "severity": "high", "type": "hardcoded-secret",
         "description": "Hardcoded OpenAI-style API key in source",
         "recommendation": "Move to env vars and rotate the credential"}),
        ("sk_live_", {"category": "security", "severity": "high", "type": "hardcoded-secret",
         "description": "Hardcoded live Stripe key",
         "recommendation": "Move to env vars and rotate the credential"}),
        ("postgresql://", {"category": "security", "severity": "high", "type": "hardcoded-secret",
         "description": "Database connection string with embedded password",
         "recommendation": "Use env vars or secrets manager"}),
        ("cors({ origin: '*'", {"category": "security", "severity": "high", "type": "cors-misconfiguration",
         "description": "CORS wildcard origin — dangerous with credentials",
         "recommendation": "Whitelist specific origins"}),
        ("== expected", {"category": "security", "severity": "medium", "type": "timing-attack",
         "description": "Plain string comparison of secrets — timing attack",
         "recommendation": "Use constant-time comparison"}),
        ("forEach(async", {"category": "quality", "severity": "medium", "type": "async-foreach-bug",
         "description": "forEach with async callback — promises not awaited",
         "recommendation": "Use for...of or Promise.all"}),
        ("for (const item of data.items) { if (item.active) { if (item.price", {"category": "maintainability", "severity": "low", "type": "deep-nesting",
         "description": "Six levels of nesting — readability hit",
         "recommendation": "Use early returns or extract a helper"}),
        ("[a-zA-Z]+)+", {"category": "security", "severity": "high", "type": "redos",
         "description": "Nested quantifier in regex — ReDoS",
         "recommendation": "Refactor regex"}),
        ("let counter = 0", {"category": "quality", "severity": "high", "type": "race-condition",
         "description": "Read-modify-write on shared state with await in middle — race",
         "recommendation": "Use atomic operations or a mutex"}),
        ("console.log", {"category": "quality", "severity": "low", "type": "debug-code",
         "description": "console.log statement — should be removed or use a logger",
         "recommendation": "Use a proper logger"}),
        ("TASK", {"category": "maintainability", "severity": "low", "type": "TASK-comment",
         "description": "TASK marker indicates incomplete work",
         "recommendation": "Track in issue tracker"}),
        ("FIX_NOW", {"category": "maintainability", "severity": "medium", "type": "FIX_NOW-known-bug",
         "description": "FIX_NOW indicates a known bug",
         "recommendation": "File an issue and prioritise the fix"}),
        (": any", {"category": "quality", "severity": "medium", "type": "any-type-abuse",
         "description": "Use of `any` defeats TypeScript type safety",
         "recommendation": "Use proper types or generics"}),
        ("def ", {"category": "quality", "severity": "low", "type": "missing-test-coverage",
         "description": "Exported function — verify test coverage exists",
         "recommendation": "Add a test file"}),
        ("await db.products.update", {"category": "quality", "severity": "high", "type": "no-error-handling",
         "description": "Async function with awaits but no try/catch",
         "recommendation": "Wrap awaits in try/catch"}),
        ("readFileSync(path, 'utf-8');", {"category": "quality", "severity": "high", "type": "resource-leak",
         "description": "File handle opened but not closed",
         "recommendation": "Use fs.promises.open with try/finally"}),
        ("fs.openSync", {"category": "quality", "severity": "high", "type": "resource-leak",
         "description": "File handle opened with fs.openSync — must be closed",
         "recommendation": "Use fs.promises.open with try/finally"}),
        ("await db.orders", {"category": "performance", "severity": "high", "type": "n-plus-1-query",
         "description": "Database query inside a for-loop — N+1",
         "recommendation": "Use a single JOIN or include()"}),
        ("readFileSync", {"category": "performance", "severity": "high", "type": "blocking-event-loop",
         "description": "Synchronous file I/O blocks the event loop",
         "recommendation": "Use the async readFile variant"}),
        ("if item in seen", {"category": "performance", "severity": "medium", "type": "quadratic-complexity",
         "description": "O(n²) — `in` on a list is linear",
         "recommendation": "Convert to a set for O(1) lookups"}),
        ("def add_item(item, cart=[])", {"category": "quality", "severity": "high", "type": "mutable-default-argument",
         "description": "Mutable list as default argument",
         "recommendation": "Use None and create the list inside the function"}),
    ]

    def __init__(self, model: Optional[str] = None):
        self.model = model or "mock-reviewer-v1"
        self._intelligent = os.getenv("VIBESERVE_MOCK_INTELLIGENCE", "true").lower() != "false"

    @property
    def name(self) -> str:
        return "Mock"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self._intelligent:
            return _json.dumps({
                "reasoning": "Mock provider — minimal mode.",
                "findings": []
            })

        for trigger_phrase, template in self.CODE_GEN_TEMPLATES:
            if trigger_phrase in prompt:
                return template

        if "refactor" in prompt.lower() and '"edits"' in prompt:
            import re
            m = re.search(r'rename\s+`?(\w+)`?\s+to\s+`?(\w+)`?', prompt, re.IGNORECASE)
            if m:
                old_name, new_name = m.group(1), m.group(2)
                edits = []
                lines = prompt.split("\n")
                cur_file = None
                for line in lines:
                    if line.startswith("--- ") and line.endswith(" ---"):
                        cur_file = line[4:-4].strip()
                    elif cur_file and old_name in line and "find" not in line.lower():
                        edits.append({
                            "file": cur_file,
                            "find": line.strip(),
                            "replace": line.replace(old_name, new_name).strip(),
                            "symbol": old_name,
                            "confidence": 0.8,
                        })
                return _json.dumps({
                    "reasoning": f"Mock refactor: rename {old_name} → {new_name}, proposed {len(edits)} edit(s).",
                    "edits": edits,
                })
            return _json.dumps({"reasoning": "Mock refactor: no rename pattern matched.", "edits": []})

        if "JSON array" in prompt and ("path" in prompt or "file" in prompt.lower()):
            return _json.dumps([{
                "path": "generated.tsx",
                "language": "tsx",
                "content": "// Generated by MockProvider\nconst x: number = 42;\nexport default x;\n",
                "purpose": "Fallback generated code",
            }])

        findings = []
        seen_keys: set = set()
        for pattern_str, finding in self.INTELLIGENT_PATTERNS:
            if pattern_str in prompt and pattern_str not in seen_keys:
                seen_keys.add(pattern_str)
                idx = prompt.find(pattern_str)
                line = 0
                if idx > 0:
                    back = prompt[max(0, idx - 80):idx]
                    import re as _re
                    m = _re.search(r'^\s*(\d+)\s*\|', back, _re.MULTILINE)
                    if m:
                        try:
                            line = int(m.group(1))
                        except ValueError:
                            line = 0
                findings.append({
                    "category": finding["category"],
                    "severity": finding["severity"],
                    "line": line,
                    "type": finding["type"],
                    "description": finding["description"],
                    "recommendation": finding["recommendation"],
                    "confidence": 0.85,
                })

        return _json.dumps({
            "reasoning": f"Mock provider — detected {len(findings)} known pattern(s) in the prompt.",
            "findings": findings,
        })


def is_mock(obj: object) -> bool:
    """Return True if obj is likely a mock/non-real provider."""
    return isinstance(obj, MockProvider) or "Mock" in type(obj).__name__


def create_provider(name: str, **kwargs) -> LLMProvider:
    """Factory to create a provider by name."""
    from vibeserve.providers.openai import OpenAIProvider
    from vibeserve.providers.deepseek import DeepSeekProvider
    from vibeserve.providers.gemini import GeminiProvider
    from vibeserve.providers.ollama import OllamaCloudProvider
    from vibeserve.providers.local import LocalProvider
    from vibeserve.providers.opencode import OpenCodeProvider

    registry = {
        "openai": OpenAIProvider,
        "deepseek": DeepSeekProvider,
        "gemini": GeminiProvider,
        "ollama": OllamaCloudProvider,
        "local": LocalProvider,
        "opencode": OpenCodeProvider,
        "mock": MockProvider,
    }
    cls = registry.get(name.lower())
    if cls is None:
        raise ValueError(f"Unknown provider: {name}")
    return cls(**kwargs)
