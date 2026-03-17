// backend/scripts/test-vendors.ts
// Run: npx tsx scripts/test-vendors.ts

import 'dotenv/config';

const TESTS: Record<string, () => Promise<void>> = {};
const results: { name: string; pass: boolean; error?: string; data?: any }[] = [];

function test(name: string, fn: () => Promise<void>) {
  TESTS[name] = fn;
}

async function runAll() {
  console.log('\n🧪 ClauseAI Vendor Service Tests\n');
  console.log('='.repeat(60));

  for (const [name, fn] of Object.entries(TESTS)) {
    process.stdout.write(`\n▶ ${name}... `);
    try {
      await fn();
      console.log('✅ PASS');
      results.push({ name, pass: true });
    } catch (err: any) {
      console.log('❌ FAIL');
      console.log(`  Error: ${err.message}`);
      results.push({ name, pass: false, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} total\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
  }
  console.log('');
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ============================================================
// OPENAI TESTS
// ============================================================
// Requires: OPENAI_ADMIN_KEY in .env (Admin API key, NOT regular key)

const OPENAI_KEY = process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY;

if (OPENAI_KEY) {
  test('OpenAI: admin key validates against /v1/organization/projects', async () => {
    const res = await fetch('https://api.openai.com/v1/organization/projects?limit=1', {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data: any = await res.json();
    assert(Array.isArray(data.data), 'Expected data.data to be an array');
    assert(data.data.length > 0, 'Expected at least 1 project');
    console.log(`(${data.data.length} project(s))`);
  });

  test('OpenAI: fetchUsage returns model-level token data', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/openai.service');
    const result = await getNormalizedUsage({ apiKey: OPENAI_KEY! });

    assert(result.vendor === 'OpenAI', `Expected vendor 'OpenAI', got '${result.vendor}'`);
    assert(Array.isArray(result.usage), 'Expected usage to be an array');
    // Usage might be empty if no API calls in last 30 days — that's OK
    console.log(`(${result.usage.length} usage entries, ${result.projects.length} projects)`);

    // If there IS usage, verify shape
    if (result.usage.length > 0) {
      const first = result.usage[0];
      assert(typeof first.modelOrResource === 'string', 'Expected modelOrResource to be a string');
      assert(first.unit === 'tokens', `Expected unit 'tokens', got '${first.unit}'`);
    }
  });

  test('OpenAI: fetchCostMetrics returns dollar amounts', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/openai.service');
    const result = await getNormalizedUsage({ apiKey: OPENAI_KEY! });

    assert(Array.isArray(result.costMetrics), 'Expected costMetrics to be an array');
    console.log(`(${result.costMetrics.length} cost entries)`);

    if (result.costMetrics.length > 0) {
      const first = result.costMetrics[0];
      assert(typeof first.amount === 'number', 'Expected amount to be a number');
      assert(first.currency === 'USD', `Expected currency 'USD', got '${first.currency}'`);
      console.log(`  Total: $${result.costMetrics.reduce((s, c) => s + c.amount, 0).toFixed(2)}`);
    }
  });
} else {
  test('OpenAI: SKIPPED (no OPENAI_ADMIN_KEY or OPENAI_API_KEY in .env)', async () => {
    console.log('(set OPENAI_ADMIN_KEY to enable)');
  });
}

// ============================================================
// ANTHROPIC TESTS
// ============================================================

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (ANTHROPIC_KEY) {
  test('Anthropic: key validates against /v1/models', async () => {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': ANTHROPIC_KEY!,
        'anthropic-version': '2023-06-01',
      },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.data && data.data.length > 0, 'Expected at least 1 model');
    console.log(`(${data.data.length} models)`);
  });

  test('Anthropic: fetchUsage returns model list', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/anthropic.service');
    const result = await getNormalizedUsage({ apiKey: ANTHROPIC_KEY! });

    assert(result.vendor === 'Anthropic', `Expected vendor 'Anthropic', got '${result.vendor}'`);
    assert(Array.isArray(result.usage), 'Expected usage to be an array');
    assert(result.usage.length > 0, 'Expected at least 1 model in usage');
    console.log(`(${result.usage.length} models available)`);
  });
} else {
  test('Anthropic: SKIPPED (no ANTHROPIC_API_KEY in .env)', async () => {
    console.log('(set ANTHROPIC_API_KEY to enable)');
  });
}

// ============================================================
// PINECONE TESTS
// ============================================================

const PINECONE_KEY = process.env.PINECONE_API_KEY;

if (PINECONE_KEY) {
  test('Pinecone: key validates against /indexes', async () => {
    const res = await fetch('https://api.pinecone.io/indexes', {
      headers: { 'Api-Key': PINECONE_KEY! },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.indexes), 'Expected indexes to be an array');
    console.log(`(${data.indexes.length} indexes)`);
  });

  test('Pinecone: fetchUsage returns index stats', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/pinecone.service');
    const result = await getNormalizedUsage({ apiKey: PINECONE_KEY! });

    assert(result.vendor === 'Pinecone', `Expected vendor 'Pinecone', got '${result.vendor}'`);
    assert(Array.isArray(result.usage), 'Expected usage to be an array');
    console.log(`(${result.usage.length} indexes found)`);

    if (result.usage.length > 0) {
      const first = result.usage[0];
      assert(typeof first.modelOrResource === 'string', 'Expected modelOrResource (index name) to be string');
      assert(first.unit === 'vectors', `Expected unit 'vectors', got '${first.unit}'`);
      console.log(`  First index: ${first.modelOrResource}, ${first.usageAmount ?? '?'} vectors`);
    }
  });
} else {
  test('Pinecone: SKIPPED (no PINECONE_API_KEY in .env)', async () => {
    console.log('(set PINECONE_API_KEY to enable)');
  });
}

// ============================================================
// GOOGLE AI TESTS
// ============================================================

const GOOGLE_KEY = process.env.GOOGLE_AI_API_KEY;

if (GOOGLE_KEY) {
  test('Google AI: key validates against /v1beta/models', async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_KEY}`
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.models), 'Expected models to be an array');
    assert(data.models.length > 0, 'Expected at least 1 model');
    console.log(`(${data.models.length} models)`);
  });

  test('Google AI: fetchUsage returns model list', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/google.service');
    const result = await getNormalizedUsage({ apiKey: GOOGLE_KEY! });

    assert(result.vendor === 'Google Vertex AI', `Expected vendor 'Google Vertex AI', got '${result.vendor}'`);
    assert(Array.isArray(result.usage), 'Expected usage to be an array');
    console.log(`(${result.usage.length} models available)`);
  });
} else {
  test('Google AI: SKIPPED (no GOOGLE_AI_API_KEY in .env)', async () => {
    console.log('(set GOOGLE_AI_API_KEY to enable)');
  });
}

// ============================================================
// LANGSMITH TESTS
// ============================================================

const LANGSMITH_KEY = process.env.LANGSMITH_API_KEY;

if (LANGSMITH_KEY) {
  test('LangSmith: key validates against /api/v1/sessions', async () => {
    const res = await fetch('https://api.smith.langchain.com/api/v1/sessions?limit=1', {
      headers: { 'x-api-key': LANGSMITH_KEY! },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
  });

  test('LangSmith: fetchUsage returns sessions', async () => {
    const { getNormalizedUsage } = await import('../src/services/vendors/langsmith.service');
    const result = await getNormalizedUsage({ apiKey: LANGSMITH_KEY! });

    assert(result.vendor === 'LangSmith', `Expected vendor 'LangSmith', got '${result.vendor}'`);
    assert(Array.isArray(result.usage), 'Expected usage to be an array');
    console.log(`(${result.usage.length} sessions)`);
  });
} else {
  test('LangSmith: SKIPPED (no LANGSMITH_API_KEY in .env)', async () => {
    console.log('(set LANGSMITH_API_KEY to enable)');
  });
}

// ============================================================
// RUN
// ============================================================
runAll().catch(console.error);