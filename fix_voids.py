import re
import os

files = [
    "app/api/invoices/route.ts",
    "app/api/invoices/remind/route.ts",
    "app/api/agent/revoke-subagent/route.ts",
    "app/api/agent/promote-subagent/route.ts",
    "app/api/messenger/call-signal/route.ts",
    "app/api/messenger/call-signal-unload-broadcast/route.ts"
]

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Replace "void " with "await " but only for specific known function calls
    content = re.sub(r'void (notify|notifyPaymentReminder|notifyRoleRevoked|Promise\.all|recordCallTelemetry|broadcastCallSignalServer|enqueueCallRingPush|sendCallRingPushNow|svc\.removeChannel)\(', r'await \1(', content)
    
    with open(f, 'w') as file:
        file.write(content)
