import { HookConfig, HookResult } from '../types/hooks';
import { runShellCommand } from './realTools';

export async function runHook(hook: HookConfig, context: any): Promise<HookResult> {
  const start = Date.now();
  console.log(`[HOOK] Executing: ${hook.name} (${hook.phase})`);
  
  try {
    const result = await runShellCommand(hook.command, process.cwd(), 30000);
    const duration = Date.now() - start;
    
    return {
      hookId: hook.id,
      phase: hook.phase,
      success: result.code === 0,
      output: result.stdout || result.stderr,
      duration,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      hookId: hook.id,
      phase: hook.phase,
      success: false,
      output: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
}

export async function runHooksForPhase(phase: string, hooks: HookConfig[], context: any): Promise<HookResult[]> {
  const relevantHooks = hooks.filter(h => h.phase === phase && h.enabled);
  const results: HookResult[] = [];
  
  for (const hook of relevantHooks) {
    results.push(await runHook(hook, context));
  }
  
  return results;
}
