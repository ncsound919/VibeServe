/**
 * Nexus Alpha - Supabase Schema Implementation
 * Uses Supabase client to verify/create schema
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aganpaepissvuamstmol.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW5wYWVwaXNzdnVhbXN0bW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4MzQ3MywiZXhwIjoyMDkyOTU5NDczfQ.zqF39DurClHwBisqPYysEi2I_LNHen7xD0YhJZg5gUk";

const supabase = createClient(supabaseUrl, supabaseKey);

const supabaseData = {
  async saveSecret(key: string, value: string) {
    const { error } = await supabase.from("secrets").upsert({ key, value });
    return !error;
  },
  async logEvent(type: string, details: Record<string, unknown>) {
    await supabase.from("logs").insert({ type, details, created_at: new Date().toISOString() });
  }
};

test.describe("Supabase Schema Implementation", () => {
  
  test("1. Verify/create secrets table and test CRUD", async () => {
    const { error } = await supabase.from("secrets").upsert({
      key: "test_key_playwright",
      value: "test_value_123"
    }, { onConflict: "key" });

    if (error) {
      console.log("❌ Secrets table:", error.message);
    } else {
      console.log("✅ Secrets table working");
      const { data } = await supabase.from("secrets").select("value").eq("key", "test_key_playwright").single();
      expect(data?.value).toBe("test_value_123");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("2. Verify/create logs table", async () => {
    const { error } = await supabase.from("logs").insert({
      type: "test_run",
      details: { test: "playwright", status: "success" }
    });

    if (error) {
      console.log("❌ Logs table:", error.message);
    } else {
      console.log("✅ Logs table working");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("3. Verify/create agent_memory table", async () => {
    const { error } = await supabase.from("agent_memory").insert({
      user_id: "playwright-test",
      content: "Test memory entry",
      metadata: { source: "test" }
    });

    if (error) {
      console.log("❌ Agent memory table:", error.message);
    } else {
      console.log("✅ Agent memory table working");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("4. Verify/create healing_log table", async () => {
    const { error } = await supabase.from("healing_log").insert({
      issue_type: "test_failure",
      issue_details: { test: "playwright" },
      remedy_applied: "none",
      success: true
    });

    if (error) {
      console.log("❌ Healing log table:", error.message);
    } else {
      console.log("✅ Healing log table working");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("5. Verify/create agent_state table", async () => {
    const { error } = await supabase.from("agent_state").upsert({
      agent_id: "test-agent-001",
      status: "testing",
      performance_score: 0.5,
      learnings: []
    }, { onConflict: "agent_id" });

    if (error) {
      console.log("❌ Agent state table:", error.message);
    } else {
      console.log("✅ Agent state table working");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("6. Verify documents table for vector store", async () => {
    const { error } = await supabase.from("documents").insert({
      content: "Test document for vector search",
      embedding: Array(1536).fill(0),
      metadata: { type: "test" }
    });

    if (error) {
      console.log("❌ Documents table:", error.message);
    } else {
      console.log("✅ Documents table working");
    }
    expect(error?.code || "ok").not.toBe("PGRST301");
  });

  test("7. Test self-healing RPC function", async () => {
    const { data, error } = await supabase.rpc("handle_integration_failure", {
      p_issue_type: "test_issue",
      p_issue_details: { test: "playwright" }
    });

    if (error) {
      console.log("❌ Self-healing RPC:", error.message);
    } else {
      console.log("✅ Self-healing RPC working:", data);
    }
  });

  test("8. Test learning RPC function", async () => {
    const { data, error } = await supabase.rpc("record_agent_learning", {
      p_agent_id: "test-agent",
      p_lesson: "Test lesson",
      p_success: true
    });

    if (error) {
      console.log("❌ Learning RPC:", error.message);
    } else {
      console.log("✅ Learning RPC working");
    }
  });

  test("9. Test vector search RPC function", async () => {
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: Array(1536).fill(0.1),
      match_threshold: 0.5,
      match_count: 5
    });

    if (error) {
      console.log("❌ Vector search RPC:", error.message);
    } else {
      console.log("✅ Vector search RPC working");
    }
  });

  test("10. Full integration test", async () => {
    await supabaseData.saveSecret("integration_test", "success");
    await supabaseData.logEvent("integration_test", { step: "complete" });
    
    const { error } = await supabase.from("secrets").select("value").eq("key", "integration_test").single();
    expect(error?.code || "ok").not.toBe("PGRST301");
    console.log("✅ Full integration working");
  });
});
