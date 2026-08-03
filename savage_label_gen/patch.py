import re

with open('generate_all.js', 'r') as f:
    code = f.read()

# Replace supabase storage logic with local file logic
upload_logic = """    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('print-labels')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`Failed to upload ${filePath}:`, uploadError);
    } else {
      successCount++;
    }"""

local_logic = """    const destPath = require('path').join(require('os').homedir(), 'Desktop', 'Savage_Labels_Local', `${product.slug}_${doseText}.png`);
    require('fs').mkdirSync(require('path').dirname(destPath), { recursive: true });
    require('fs').writeFileSync(destPath, buffer);
    successCount++;"""

code = code.replace(upload_logic, local_logic)
code = code.replace("const filePath = `savage/${product.slug}.png`;", "")
code = code.replace("console.log(`[${i+1}/${ap.length}] Uploading ${filePath}", "console.log(`[${i+1}/${ap.length}] Saving")

with open('generate_local.js', 'w') as f:
    f.write(code)

