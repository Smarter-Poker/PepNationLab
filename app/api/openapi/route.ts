import { NextResponse } from 'next/server';

export async function GET() {
  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'Pep Nation Lab Research API',
      description: 'API for accessing research-grade peptide monographs, pharmacokinetics, and evidence tiers for in vitro laboratory research.',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://pepnationlab.com',
      },
    ],
    paths: {
      '/api/llm/compound/{slug}': {
        get: {
          summary: 'Get Compound Monograph',
          description: 'Retrieves the full markdown-formatted research monograph for a specific compound, including half-life, molecular weight, evidence tier, and references.',
          operationId: 'getCompoundMonograph',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              description: 'The URL slug of the compound (e.g., retatrutide, bpc-157, semaglutide).',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'A markdown document containing the compound research data.',
              content: {
                'text/markdown': {
                  schema: {
                    type: 'string',
                  },
                },
              },
            },
            '404': {
              description: 'Compound not found.',
            },
          },
        },
      },
      '/llms.txt': {
        get: {
          summary: 'Get Compound Directory',
          description: 'Retrieves the complete list of available research compounds and their corresponding slugs.',
          operationId: 'getCompoundDirectory',
          responses: {
            '200': {
              description: 'A markdown document listing all compounds.',
              content: {
                'text/plain': {
                  schema: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openapi, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  });
}
