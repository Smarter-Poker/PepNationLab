const { z } = require('zod');
const CheckoutSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty.'),
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
  idempotencyKey: z.string().uuid().optional().nullable(),
  wholesale: z.boolean().optional(),
  agentSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(),
});

const payload = {
  items: [{ id: "550e8400-e29b-41d4-a716-446655440000", quantity: 1 }],
  shippingAddress: null,
  fulfillmentMethod: "agent_pickup",
  paymentMethod: "zelle",
  couponCode: null,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
  agentSlug: null
};

const result = CheckoutSchema.safeParse(payload);
console.log(JSON.stringify(result, null, 2));
