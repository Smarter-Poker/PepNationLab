import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST() {
  const supabase = await createServiceClient();

  // Fetch products that need embeddings
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description, category')
    .is('embedding', null)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ message: 'No products need embeddings' }, { status: 200 });
  }

  const results = [];

  for (const product of products) {
    const textToEmbed = `Product: ${product.name}\nCategory: ${product.category}\nDescription: ${product.description || ''}`;
    
    try {
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: textToEmbed,
      });
      
      const embedding = response.embeddings?.[0]?.values;
      
      if (!embedding || embedding.length !== 768) {
        console.error('Invalid embedding for product', product.id);
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('products')
        .update({ embedding })
        .eq('id', product.id);
        
      if (updateError) {
        console.error('Failed to update product', product.id, updateError);
      } else {
        results.push(product.id);
      }
    } catch (e) {
      console.error('Embedding API error for product', product.id, e);
    }
  }

  return NextResponse.json({
    message: `Generated embeddings for ${results.length} products`,
    processed: results.length,
    remainingToProcess: products.length - results.length
  });
}
