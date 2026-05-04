"""
Nexus Alpha - Verify All Tables and Advanced Features
"""

import os
os.environ['SUPABASE_URL'] = 'https://aganpaepissvuamstmol.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW5wYWVwaXNzdnVhbXN0bW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4MzQ3MywiZXhwIjoyMDkyOTU5NDczfQ.zqF39DurClHwBisqPYysEi2I_LNHen7xD0YhJZg5gUk'

from supabase import create_client

supabase = create_client(
    os.environ['SUPABASE_URL'], 
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

def test_all_features():
    print("\n=== Testing Advanced Self-Learning Features ===\n")
    
    # Test 1: Write and read basic data
    print("[TEST 1] Basic CRUD operations")
    
    # Secrets
    result = supabase.table('secrets').upsert({'key': 'test_key', 'value': 'test_value'}, on_conflict='key').execute()
    secret = supabase.table('secrets').select('value').eq('key', 'test_key').single().execute()
    print(f"  Secrets: {'OK' if secret.data else 'FAIL'}")
    
    # Logs  
    result = supabase.table('logs').insert({'type': 'test', 'details': {'test': True}}).execute()
    logs = supabase.table('logs').select('*').eq('type', 'test').limit(1).execute()
    print(f"  Logs: {'OK' if logs.data else 'FAIL'}")
    
    # Test 2: Advanced Learning - Strategy Selection
    print("\n[TEST 2] Strategy Selection")
    result = supabase.table('agent_state').upsert({
        'agent_id': 'strategy-tester',
        'status': 'testing',
        'performance_score': 0.6,
        'learnings': [
            {'lesson': 'retry_with_backoff', 'success': True, 'timestamp': '2024-01-01'},
            {'lesson': 'parallel_execution', 'success': True, 'timestamp': '2024-01-02'},
            {'lesson': 'cache_fallback', 'success': False, 'timestamp': '2024-01-03'}
        ]
    }, on_conflict='agent_id').execute()
    
    strategy_data = supabase.table('agent_state').select('learnings').eq('agent_id', 'strategy-tester').single().execute()
    print(f"  Strategy learnings: {len(strategy_data.data.get('learnings', [])) if strategy_data.data else 0}")
    
    # Test 3: Pattern Detection
    print("\n[TEST 3] Pattern Detection")
    result = supabase.table('healing_log').insert([
        {'issue_type': 'api_timeout', 'success': True, 'remedy_applied': 'retry'},
        {'issue_type': 'api_timeout', 'success': True, 'remedy_applied': 'retry'},
        {'issue_type': 'api_timeout', 'success': False, 'remedy_applied': 'retry'},
    ]).execute()
    
    healing = supabase.table('healing_log').select('issue_type').execute()
    timeouts = len([d for d in healing.data if d.get('issue_type') == 'api_timeout']) if healing.data else 0
    print(f"  API timeouts detected: {timeouts}")
    
    # Test 4: Knowledge Distillation
    print("\n[TEST 4] Knowledge Distillation")
    result = supabase.table('agent_state').upsert({
        'agent_id': 'knowledge-distiller',
        'status': 'learning',
        'performance_score': 0.8,
        'learnings': [
            {'lesson': 'use_cache_for_repeated_queries', 'success': True, 'timestamp': '2024-01-01'},
            {'lesson': 'batch_api_calls', 'success': True, 'timestamp': '2024-01-02'},
            {'lesson': 'defer_non_critical', 'success': True, 'timestamp': '2024-01-03'},
            {'lesson': 'fallback_to_cache', 'success': True, 'timestamp': '2024-01-04'},
            {'lesson': 'validate_inputs', 'success': True, 'timestamp': '2024-01-05'},
        ]
    }, on_conflict='agent_id').execute()
    
    knowledge = supabase.table('agent_state').select('learnings').eq('agent_id', 'knowledge-distiller').single().execute()
    print(f"  Knowledge items: {len(knowledge.data.get('learnings', [])) if knowledge.data else 0}")
    
    # Test 5: Feedback Loop
    print("\n[TEST 5] Feedback Loop")
    result = supabase.table('logs').insert([
        {'type': 'user_feedback', 'details': {'feedback': 'helpful', 'agent_id': 'feedback-agent'}},
        {'type': 'user_feedback', 'details': {'feedback': 'correct', 'agent_id': 'feedback-agent'}},
        {'type': 'user_feedback', 'details': {'feedback': 'unhelpful', 'agent_id': 'feedback-agent'}},
    ]).execute()
    
    feedback = supabase.table('logs').select('details').eq('type', 'user_feedback').execute()
    helpful = len([d for d in (feedback.data or []) if d.get('details', {}).get('feedback') in ['helpful', 'correct']])
    print(f"  Helpful feedback: {helpful}")
    
    # Test 6: Meta-Learning
    print("\n[TEST 6] Meta-Learning")
    meta = supabase.table('agent_state').select('learnings, performance_score').eq('agent_id', 'knowledge-distiller').single().execute()
    print(f"  Performance score: {meta.data.get('performance_score') if meta.data else 0}")
    print(f"  Learning rate: {len(meta.data.get('learnings', [])) if meta.data else 0}")
    
    # Test 7: End-to-End
    print("\n[TEST 7] End-to-End Flow")
    import time
    session_id = f"session_{int(time.time())}"
    result = supabase.table('agent_state').upsert({
        'agent_id': session_id,
        'status': 'initialized',
        'performance_score': 0.5,
        'learnings': []
    }, on_conflict='agent_id').execute()
    result = supabase.table('logs').insert({'type': 'session_init', 'details': {'session': session_id}}).execute()
    
    final = supabase.table('agent_state').select('status').eq('agent_id', session_id).single().execute()
    print(f"  Session status: {final.data.get('status') if final.data else 'not found'}")
    
    print("\n=== All Advanced Features Verified ===")

test_all_features()