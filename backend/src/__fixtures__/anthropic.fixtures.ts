export const ANTHROPIC_ADMIN_USAGE_RESPONSE = {
  data: [
    {
      bucket_start_time: '2025-03-20T00:00:00Z',
      results: [
        {
          model: 'claude-sonnet-4-20250514',
          uncached_input_tokens: 2850000,
          cache_read_input_tokens: 150000,
          output_tokens: 420000,
          cache_creation: { ephemeral_5m_input_tokens: 50000, ephemeral_1h_input_tokens: 0 },
        },
        {
          model: 'claude-haiku-4-5-20251001',
          uncached_input_tokens: 8200000,
          cache_read_input_tokens: 800000,
          output_tokens: 1100000,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        },
        {
          model: 'claude-opus-4-20250514',
          uncached_input_tokens: 120000,
          cache_read_input_tokens: 0,
          output_tokens: 35000,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        },
      ],
    },
    {
      bucket_start_time: '2025-03-21T00:00:00Z',
      results: [
        {
          model: 'claude-sonnet-4-20250514',
          uncached_input_tokens: 3100000,
          cache_read_input_tokens: 200000,
          output_tokens: 480000,
          cache_creation: { ephemeral_5m_input_tokens: 30000, ephemeral_1h_input_tokens: 0 },
        },
        {
          model: 'claude-haiku-4-5-20251001',
          uncached_input_tokens: 7500000,
          cache_read_input_tokens: 600000,
          output_tokens: 950000,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        },
      ],
    },
  ],
  has_more: false,
};

export const ANTHROPIC_COST_RESPONSE = {
  data: [
    {
      bucket_start_time: '2025-03-20T00:00:00Z',
      results: [
        { workspace_id: 'wrkspc_support_team', amount: '42.50' },
        { workspace_id: 'wrkspc_ml_research', amount: '18.75' },
      ],
    },
    {
      bucket_start_time: '2025-03-21T00:00:00Z',
      results: [
        { workspace_id: 'wrkspc_support_team', amount: '38.20' },
        { workspace_id: 'wrkspc_ml_research', amount: '22.10' },
      ],
    },
  ],
  has_more: false,
};

export const ANTHROPIC_WORKSPACES_RESPONSE = {
  data: [
    { id: 'wrkspc_support_team', display_name: 'Customer Support AI' },
    { id: 'wrkspc_ml_research', display_name: 'ML Research' },
  ],
};

export const ANTHROPIC_MODELS_RESPONSE = {
  data: [
    { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', created_at: '2025-05-14' },
    { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01' },
    { id: 'claude-opus-4-20250514', display_name: 'Claude Opus 4', created_at: '2025-05-14' },
    { id: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet', created_at: '2024-10-22' },
  ],
};
