/**
 * Nexus Alpha - Debug Supabase Client
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aganpaepissvuamstmol.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW5wYWVwaXNzdnVhbXN0bW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4MzQ3MywiZXhwIjoyMDkyOTU5NDczfQ.zqF39DurClHwBisqPYysEi2I_LNHen7xD0YhJZg5gUk";

const supabase = createClient(supabaseUrl, supabaseKey);

test("Debug Supabase connection", async () => {
  console.log("Testing direct Supabase connection...");
  
  // Test 1: Insert into logs
  const { data: logData, error: logError } = await supabase
    .from("logs")
    .insert({ type: "debug_test", details: { test: "hello" } });
  
  console.log("Insert log result:", logError ? logError.message : "success", logData);
  
  // Test 2: Query logs
  const { data: queryData, error: queryError } = await supabase
    .from("logs")
    .select("*")
    .eq("type", "debug_test")
    .limit(5);
  
  console.log("Query result:", queryError ? queryError.message : "success");
  console.log("Found:", queryData?.length, "records");
  
  // Test 3: Query agent_state  
  const { data: stateData, error: stateError } = await supabase
    .from("agent_state")
    .select("*")
    .limit(3);
  
  console.log("Agent state:", stateError ? stateError.message : "success", stateData?.length, "records");
  
  // Assertions
  expect(queryError?.code || "ok").not.toBe("PGRST301"); // Not network error
  expect(stateError?.code || "ok").not.toBe("PGRST301");
});

test("Debug learning storage", async () => {
  // Try inserting with explicit JSON array format
  const learnings = [
    { lesson: "test_lesson", success: true, timestamp: new Date().toISOString() }
  ];
  
  const { data, error } = await supabase
    .from("agent_state")
    .upsert({
      agent_id: "debug-agent",
      status: "testing",
      performance_score: 0.5,
      learnings: learnings
    }, { onConflict: "agent_id" })
    .select();
  
  console.log("Upsert result:", error ? error.message : "success", data);
  
  // Read back
  const { data: readBack } = await supabase
    .from("agent_state")
    .select("learnings")
    .eq("agent_id", "debug-agent")
    .single();
  
  console.log("Read back:", readBack?.learnings);
  
  // Check if learnings is an array
  expect(Array.isArray(readBack?.learnings)).toBe(true);
});
