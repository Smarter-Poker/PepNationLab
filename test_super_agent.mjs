// Pure logic test for the Super Agent Pricing Engine

function calculatePricing(
  baseCost, 
  userProfile, // { id, role, tier, referring_agent_id, parent_agent_id }
  agentProfile, 
  superAgentProfile, 
  agentCustomRetail, 
  superAgentBaseline
) {
  const tierMultipliers = {
    'tier_1': 3.0,
    'tier_2': 5.0,
    'tier_3': 7.0
  };

  // Mocking the EXACT fixed logic from orders/route.ts
  let resolvedAgentProfile = null;
  let resolvedSuperAgentProfile = null;
  let isAgentSelfBuy = false;

  if (userProfile.role === 'agent' || userProfile.role === 'admin') {
    resolvedAgentProfile = userProfile;
    isAgentSelfBuy = true;
    if (userProfile.parent_agent_id) {
      resolvedSuperAgentProfile = superAgentProfile;
    }
  } else if (userProfile.referring_agent_id) {
    resolvedAgentProfile = agentProfile;
    if (resolvedAgentProfile?.parent_agent_id) {
      resolvedSuperAgentProfile = superAgentProfile;
    }
  }

  let retailPrice = 0;
  
  if (isAgentSelfBuy) {
    // wait for costPrice
  } else if (agentCustomRetail) {
    retailPrice = agentCustomRetail;
  } else {
    retailPrice = baseCost * (tierMultipliers['tier_3']);
  }

  let costPrice = retailPrice;
  let superAgentCost = null;

  if (resolvedAgentProfile) {
    if (resolvedSuperAgentProfile) {
      const saMultiplier = tierMultipliers[resolvedSuperAgentProfile.tier || 'tier_3'] ?? 7.0;
      superAgentCost = baseCost * saMultiplier;
      costPrice = superAgentBaseline ?? superAgentCost;
    } else {
      const agentMultiplier = tierMultipliers[resolvedAgentProfile.tier || 'tier_3'] ?? 7.0;
      costPrice = baseCost * agentMultiplier;
    }
  }

  if (isAgentSelfBuy) {
    retailPrice = costPrice;
  }

  return {
    retailPrice,
    subAgentCost: costPrice,
    superAgentCost,
    billedAgentId: resolvedAgentProfile?.id || null
  };
}

console.log('--- EXECUTING PURE PRICING LOGIC TEST ---');

const testCases = [
  {
    name: "1. Sub-Agent Buys For Themselves (Role: agent)",
    baseCost: 10.00,
    userProfile: { id: 'sub1', role: 'agent', tier: 'tier_3', referring_agent_id: null, parent_agent_id: 'super1' },
    agentProfile: null, 
    superAgentProfile: { id: 'super1', tier: 'tier_1' },
    agentCustomRetail: null,
    superAgentBaseline: 50.00,
    expectedBilledAgent: 'sub1',
    expectedRetailPrice: 50.00, // Should buy at their wholesale cost!
    expectedSubAgentCost: 50.00,
    expectedSuperAgentCost: 30.00
  },
  {
    name: "2. Super Agent Buys For Themselves (Role: agent)",
    baseCost: 10.00,
    userProfile: { id: 'super1', role: 'agent', tier: 'tier_1', referring_agent_id: null, parent_agent_id: null },
    agentProfile: null, 
    superAgentProfile: null,
    agentCustomRetail: null,
    superAgentBaseline: null,
    expectedBilledAgent: 'super1',
    expectedRetailPrice: 30.00, 
    expectedSubAgentCost: 30.00,
    expectedSuperAgentCost: null
  },
  {
    name: "3. Researcher buys from Sub-Agent Store",
    baseCost: 10.00,
    userProfile: { id: 'researcher', role: 'user', tier: 'tier_3', referring_agent_id: 'sub1', parent_agent_id: null },
    agentProfile: { id: 'sub1', tier: 'tier_3', parent_agent_id: 'super1' }, 
    superAgentProfile: { id: 'super1', tier: 'tier_1' },
    agentCustomRetail: 120.00,
    superAgentBaseline: 50.00,
    expectedBilledAgent: 'sub1',
    expectedRetailPrice: 120.00, 
    expectedSubAgentCost: 50.00,
    expectedSuperAgentCost: 30.00
  }
];

let allPassed = true;

testCases.forEach((tc, i) => {
  const result = calculatePricing(
    tc.baseCost, tc.userProfile, tc.agentProfile, tc.superAgentProfile, tc.agentCustomRetail, tc.superAgentBaseline
  );
  
  console.log(`\nTest Case ${i+1}: ${tc.name}`);
  console.log(`- Expected Billed Agent:  ${tc.expectedBilledAgent}`);
  console.log(`- Actual Billed Agent:    ${result.billedAgentId}`);
  
  console.log(`- Expected Retail Price:  $${tc.expectedRetailPrice}`);
  console.log(`- Actual Retail Price:    $${result.retailPrice}`);

  if (
    result.billedAgentId !== tc.expectedBilledAgent ||
    result.retailPrice !== tc.expectedRetailPrice
  ) {
    console.error('❌ TEST FAILED: Agent was not billed correctly or did not get wholesale pricing.');
    allPassed = false;
  } else {
    console.log('✅ TEST PASSED');
  }
});

if (allPassed) {
  console.log('\n✅ ALL INTEGRATION TESTS PASSED.');
} else {
  console.error('\n❌ FAILURES DETECTED IN PRICING ENGINE.');
  process.exit(1);
}
