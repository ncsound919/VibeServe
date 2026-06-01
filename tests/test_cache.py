import json
import time


from vibeserve.tools.cache import CacheManager


class TestCacheManagerInit:
    def test_init_creates_directory(self, tmp_path):
        cache_dir = tmp_path / "cache"
        CacheManager(cache_dir=cache_dir, ttl=3600)
        assert cache_dir.exists()


class TestCacheManagerGetCacheKey:
    def test_get_cache_key_deterministic(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        k1 = cm.get_cache_key("dashboard", ["btn", "nav"], "ds-123")
        k2 = cm.get_cache_key("dashboard", ["btn", "nav"], "ds-123")
        assert k1 == k2
        assert len(k1) == 32

    def test_get_cache_key_different_inputs_different(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        k1 = cm.get_cache_key("dashboard", ["btn"], "ds-123")
        k2 = cm.get_cache_key("dashboard", ["nav"], "ds-123")
        assert k1 != k2


class TestCacheManagerSetGet:
    def test_get_missing_returns_none(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        assert cm.get("nonexistent") is None

    def test_set_and_get(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        key = cm.get_cache_key("page", ["req"], "ds-1")
        result = {"html": "<div>hello</div>"}
        assert cm.set(key, result)
        cached = cm.get(key)
        assert cached == result

    def test_get_expired_returns_none(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=-1)
        key = cm.get_cache_key("page", ["req"], "ds-1")
        cm.set(key, {"html": "<div>hello</div>"})
        assert cm.get(key) is None


class TestCacheManagerEviction:
    def test_evict_if_needed_removes_oldest(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        for i in range(210):
            f = tmp_path / f"{i:04d}.json"
            f.write_text(json.dumps({"timestamp": time.time(), "result": {"i": i}}))
            time.sleep(0.001)
        cm._evict_if_needed()
        remaining = list(tmp_path.glob("*.json"))
        assert len(remaining) <= cm.MAX_CACHE_FILES


class TestCacheManagerInvalidate:
    def test_invalidate_existing_returns_true(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        key = "testkey"
        cm.set(key, {"data": "value"})
        assert cm.invalidate(key) is True
        assert not (tmp_path / f"{key}.json").exists()

    def test_invalidate_missing_returns_false(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        assert cm.invalidate("nonexistent") is False


class TestCacheManagerClear:
    def test_clear_removes_all_cache_files(self, tmp_path):
        cm = CacheManager(cache_dir=tmp_path, ttl=3600)
        for i in range(5):
            cm.set(f"key{i}", {"data": i})
        cm.clear()
        assert list(tmp_path.glob("*.json")) == []
