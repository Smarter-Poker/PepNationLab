const fs = require('fs');
let code = fs.readFileSync('components/AgentOrders.tsx', 'utf8');

code = code.replace(
  /interface AgentOrdersProps \{[\s\S]*?\}/,
  `interface AgentOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  initialOpenShortId?: string | null;
  timeFilterOverride?: string;
  hideDropdown?: boolean;
}`
);

code = code.replace(
  /export default function AgentOrders\(\{ orders, setOrders, initialOpenShortId \}: AgentOrdersProps\) \{/,
  `export default function AgentOrders({ orders, setOrders, initialOpenShortId, timeFilterOverride, hideDropdown }: AgentOrdersProps) {`
);

code = code.replace(
  /const \[timeFilter, setTimeFilter\] = useState\('all'\);/,
  `const [internalTimeFilter, setTimeFilter] = useState('all');\n  const timeFilter = timeFilterOverride || internalTimeFilter;`
);

code = code.replace(
  /<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var\(--space-4\)' }}>/,
  `{!hideDropdown && (<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>`
);

code = code.replace(
  /<\/select>\s*<\/div>/,
  `</select>\n      </div>)}`
);

fs.writeFileSync('components/AgentOrders.tsx', code);
