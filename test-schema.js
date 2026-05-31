const { z } = require('zod');
const CheckoutSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().int().min(1)
  })).min(1),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']),
  paymentMethod: z.enum(['zelle', 'cashapp', 'venmo', 'apple_pay', 'apple_cash', 'paypal', 'google_wallet', 'wise', 'chime']),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    street: z.string().min(1),
    suite: z.string().optional().default(''),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(5),
    phone: z.string().optional().default(''),
  }).optional().nullable(),
  couponCode: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  wholesale: z.boolean().optional(),
  agentSlug: z.string().optional().nullable(),
});

const result = CheckoutSchema.safeParse({
  items: [{ id: "test", quantity: 1 }],
  fulfillmentMethod: 'agent_pickup',
  paymentMethod: 'zelle',
  shippingAddress: null,
});
console.log(JSON.stringify(result, null, 2));
