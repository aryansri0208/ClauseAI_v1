export const GOOGLE_MODELS_RESPONSE = {
  models: [
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] },
  ],
};

export const GOOGLE_BIGQUERY_BILLING_ROWS = [
  { service_description: 'Vertex AI', sku_description: 'Gemini 2.5 Pro Online Prediction Text Input', project_id: 'my-gcp-project', usage_amount: 8500000, usage_unit: 'count', cost: 10.63, currency: 'USD', usage_start_time: '2025-03-20T00:00:00Z' },
  { service_description: 'Vertex AI', sku_description: 'Gemini 2.5 Pro Online Prediction Text Output', project_id: 'my-gcp-project', usage_amount: 1200000, usage_unit: 'count', cost: 12.00, currency: 'USD', usage_start_time: '2025-03-20T00:00:00Z' },
  { service_description: 'Vertex AI', sku_description: 'Gemini 2.5 Flash Online Prediction Text Input', project_id: 'my-gcp-project', usage_amount: 45000000, usage_unit: 'count', cost: 6.75, currency: 'USD', usage_start_time: '2025-03-20T00:00:00Z' },
  { service_description: 'Vertex AI', sku_description: 'Gemini 2.5 Flash Online Prediction Text Output', project_id: 'my-gcp-project', usage_amount: 8000000, usage_unit: 'count', cost: 4.80, currency: 'USD', usage_start_time: '2025-03-20T00:00:00Z' },
  { service_description: 'Vertex AI', sku_description: 'Gemini 1.5 Pro Online Prediction Text Input', project_id: 'analytics-project', usage_amount: 3200000, usage_unit: 'count', cost: 4.00, currency: 'USD', usage_start_time: '2025-03-21T00:00:00Z' },
  { service_description: 'Vertex AI', sku_description: 'Gemini 1.5 Pro Online Prediction Text Output', project_id: 'analytics-project', usage_amount: 600000, usage_unit: 'count', cost: 3.00, currency: 'USD', usage_start_time: '2025-03-21T00:00:00Z' },
];
