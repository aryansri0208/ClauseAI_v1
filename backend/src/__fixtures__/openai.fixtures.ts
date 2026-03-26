export const OPENAI_USAGE_RESPONSE = {
  data: [
    {
      start_time: 1711065600,
      end_time: 1711152000,
      results: [
        { model: 'gpt-4o-2024-08-06', input_tokens: 4200000, output_tokens: 680000 },
        { model: 'gpt-4o-mini-2024-07-18', input_tokens: 12500000, output_tokens: 1800000 },
        { model: 'text-embedding-3-small', input_tokens: 25000000, output_tokens: 0 },
        { model: 'o3-mini-2025-01-31', input_tokens: 850000, output_tokens: 320000 },
      ],
    },
    {
      start_time: 1711152000,
      end_time: 1711238400,
      results: [
        { model: 'gpt-4o-2024-08-06', input_tokens: 3800000, output_tokens: 590000 },
        { model: 'gpt-4o-mini-2024-07-18', input_tokens: 11200000, output_tokens: 1650000 },
      ],
    },
  ],
  next_page: null,
};

export const OPENAI_COSTS_RESPONSE = {
  data: [
    {
      start_time: 1711065600,
      end_time: 1711152000,
      results: [
        { project_id: 'proj_customer_chatbot', amount: { value: 35.80, currency: 'USD' } },
        { project_id: 'proj_internal_tools', amount: { value: 12.40, currency: 'USD' } },
        { project_id: 'proj_embedding_pipeline', amount: { value: 2.10, currency: 'USD' } },
      ],
    },
    {
      start_time: 1711152000,
      end_time: 1711238400,
      results: [
        { project_id: 'proj_customer_chatbot', amount: { value: 31.50, currency: 'USD' } },
        { project_id: 'proj_internal_tools', amount: { value: 10.80, currency: 'USD' } },
      ],
    },
  ],
  next_page: null,
};

export const OPENAI_PROJECTS_RESPONSE = {
  data: [
    { id: 'proj_customer_chatbot', name: 'Customer Chatbot' },
    { id: 'proj_internal_tools', name: 'Internal Copilot Tools' },
    { id: 'proj_embedding_pipeline', name: 'Embedding Pipeline' },
  ],
};
