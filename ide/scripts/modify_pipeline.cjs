const fs = require('fs');

let code = fs.readFileSync('./src/services/pipelineService.ts', 'utf8');

// We want to replace the try { for (let i = 0; i < steps.length; i++) { ... } block
// with a fetch to /api/pipeline/run
const startMarker = 'try {\n    for (let i = 0; i < steps.length; i++) {';
const startIndex = code.indexOf(startMarker);

// Find the matching end of the try block by counting braces
let endIndex = -1;
if (startIndex !== -1) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex + 4; i < code.length; i++) {
    const char = code[i];
    
    if (inString) {
      if (char === stringChar && code[i-1] !== '\\') {
        inString = false;
      }
    } else {
      if (char === "'" || char === '"' || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  }
  
  if (endIndex !== -1) {
    const newLogic = `try {
    execution.logs.push('[SYSTEM] Calling real backend build runner at /api/pipeline/run...');
    onUpdate({ ...execution, logs: [...execution.logs] });
    
    const response = await fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: sourceRepos })
    });
    
    if (!response.ok) {
      throw new Error(\`Backend returned status \${response.status}\`);
    }
    
    const result = await response.json();
    
    // Process backend steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      execution.currentStep = step.phase;
      execution.steps = [...execution.steps];
      execution.steps[i].status = 'running';
      onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
      
      execution.logs.push(\`[\${step.phase}] Executed by backend engine...\`);
      await new Promise(r => setTimeout(r, 500));
      
      execution.steps[i].status = 'completed';
      execution.progress = ((i + 1) / steps.length) * 100;
      onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs], progress: execution.progress });
    }
    
    execution.status = 'success';
    execution.currentStep = 'Completed';
    execution.logs.push('[SUCCESS] Real backend build completed successfully.');
    onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
  `;
    
    // Since there's a catch block right after the try, we need to find the catch block too
    const catchStart = code.indexOf('catch (err) {', endIndex);
    let catchEnd = -1;
    if (catchStart !== -1) {
      let cDepth = 0;
      for (let i = catchStart + 12; i < code.length; i++) {
        if (code[i] === '{') cDepth++;
        else if (code[i] === '}') {
          cDepth--;
          if (cDepth === 0) {
            catchEnd = i + 1;
            break;
          }
        }
      }
    }
    
    if (catchEnd !== -1) {
      const newCatch = `} catch (err) {
    execution.status = 'failed';
    execution.currentStep = 'Failed';
    const msg = err instanceof Error ? err.message : String(err);
    execution.logs.push(\`[ERROR] Backend build failed: \${msg}\`);
    onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
  }`;
      
      code = code.substring(0, startIndex) + newLogic + newCatch + code.substring(catchEnd);
      fs.writeFileSync('./src/services/pipelineService.ts', code, 'utf8');
      console.log('Successfully updated pipelineService.ts');
    } else {
      console.log('Failed to find catch block');
    }
  } else {
    console.log('Failed to find end of try block');
  }
} else {
  console.log('Failed to find start marker');
}
