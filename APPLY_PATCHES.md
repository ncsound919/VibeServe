# How to Apply These Fixes

## Files in this patch set

```
vibeserve/auth.py                        ← Replace entirely
vibeserve/__main__.py                    ← Replace entirely
vibeserve/tools/subprocess_helper.py     ← New file, add to repo
vibeserve/models_patch.py                ← Merge into vibeserve/models.py (see below)
.github/workflows/ci.yml                 ← Replace entirely
.github/workflows/pypi.yml               ← Replace entirely
SECURITY.md                              ← New file, add to repo root
```

## Applying models_patch.py

Open `vibeserve/models.py` and replace the two classes:

```python
class FileReadInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)

class FileWriteInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    content: str = Field(min_length=0, max_length=1_000_000)
```

With the validated versions from `vibeserve/models_patch.py`.

## Applying subprocess_helper.py

In `vibeserve/tools/pipeline_tools.py`:

1. Add at the top of the imports:
   ```python
   from vibeserve.tools.subprocess_helper import _run_subprocess, SUBPROCESS_TIMEOUT
   ```

2. Replace every `subprocess.run([...], timeout=300)` call with:
   ```python
   _run_subprocess([...])
   ```

3. Replace every `except subprocess.TimeoutExpired:` block — the helper
   already kills the process group before re-raising, so your existing
   error handling remains valid.

## Rotate the DeepSeek key

The key `sk-d11b338d040441deaefdb552b80275ab` committed in
`tests/honest_audit.py` must be rotated at DeepSeek's dashboard immediately.

Then fix the file:
```python
# Before (line 3 of tests/honest_audit.py):
os.environ["DEEPSEEK_API_KEY"] = "sk-d11b338d040441deaefdb552b80275ab"

# After:
os.environ["DEEPSEEK_API_KEY"] = os.getenv("DEEPSEEK_API_KEY", "")
```

## Priority order

1. Rotate the DeepSeek API key (do this right now, before anything else)
2. Apply auth.py (fail-closed auth)
3. Apply ci.yml (full-history secret scan)  
4. Apply pypi.yml (release gate)
5. Apply __main__.py (startup validation + async input fix)
6. Apply models_patch.py (path traversal)
7. Add subprocess_helper.py and update pipeline_tools.py
8. Add SECURITY.md
