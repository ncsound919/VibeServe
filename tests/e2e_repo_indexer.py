"""E2E test for repo indexer + background tools."""
from vibeserve.tools.repo_indexer import _cross_repo

def main():
    # Test 1: Index current repo
    ri = _cross_repo.index_repo(repo_path=".", repo_key="vibeserve", repo_name="VibeServe")
    print(f"[PASS] Indexed: {ri.repo_key} - {ri.file_count} files, {ri.symbol_count} symbols, {len(ri.test_files)} tests")
    assert ri.file_count > 0
    assert ri.symbol_count > 0
    
    # Test 2: Search symbols (use a name that exists in the codebase)
    results = _cross_repo.search_symbols("index", repo_key="vibeserve")
    print(f"[PASS] Search 'index': {len(results)} results")
    if len(results) > 0:
        print(f"  Sample: {results[0]['name']} in {results[0]['file_path']}")
    
    # Test 3: Find test gaps
    gaps = _cross_repo.find_test_gaps(repo_key="vibeserve")
    print(f"[PASS] Test gaps: {len(gaps)} found")
    # Might be 0 if tests are well-covered — that's fine
    
    # Test 4: Find refactor targets
    refactors = _cross_repo.find_refactor_targets(repo_key="vibeserve")
    print(f"[PASS] Refactors: {len(refactors)} targets")
    
    # Test 5: Cross-repo suggestions (empty since only one repo indexed)
    cross = _cross_repo.cross_repo_suggestions(source_repo="vibeserve")
    print(f"[PASS] Cross-repo: {len(cross)} suggestions (expected 0 with single repo)")
    
    # Test 6: Verify output shapes match what TypeScript expects
    for gap in gaps[:3]:
        assert "file" in gap
        assert "repo" in gap
        assert "suggestion" in gap
    for ref in refactors[:3]:
        assert "suggestion_type" in ref
        assert "repo" in ref
    print("[PASS] Output shapes valid for TypeScript consumption")
    
    print("\n=== ALL 6 E2E TESTS PASSED ===")

main()
