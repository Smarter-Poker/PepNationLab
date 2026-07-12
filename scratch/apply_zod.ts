import { Project, SyntaxKind, Node } from "ts-morph";
import * as fs from "fs";

const project = new Project();
const files = project.addSourceFilesAtPaths("app/api/admin/**/*.ts");

for (const sourceFile of files) {
  const filePath = sourceFile.getFilePath();
  let modified = false;
  let fileText = sourceFile.getFullText();

  const fns = sourceFile.getFunctions().filter(f => {
    const name = f.getName();
    return name === "POST" || name === "PUT" || name === "PATCH" || name === "DELETE";
  });

  if (fns.length === 0) continue;

  let hasZodImport = fileText.includes("import { z } from \"zod\";");
  
  for (const fn of fns) {
    const fnName = fn.getName();
    const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
    let reqJsonCall = null;
    for (const call of calls) {
      const text = call.getText();
      if (text.includes("req.json()") || text.includes("request.json()")) {
        reqJsonCall = call;
        break;
      }
    }

    if (!reqJsonCall) continue;
    
    if (fn.getText().includes("__rawBody")) continue;
    if (fn.getText().includes("Body.parse(")) continue;
    if (fn.getText().includes("Schema.safeParse(")) continue;

    const schemaName = `${fnName}BodySchema`;
    const schemaStr = `\nconst ${schemaName} = z.any();\n`;

    const replacement = `
  const __rawBody = await ${reqJsonCall.getText().includes("request") ? "request" : "req"}.json().catch(() => ({}));
  const __bodyParse = ${schemaName}.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;
`;

    const assignment = reqJsonCall.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
    if (assignment && assignment.getLeft().getText() === "body") {
      const exprStmt = assignment.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
      if (exprStmt) {
        let nodeToReplace: Node = exprStmt;
        const tryBlock = exprStmt.getFirstAncestorByKind(SyntaxKind.TryStatement);
        if (tryBlock) {
          nodeToReplace = tryBlock;
        }

        const start = nodeToReplace.getStart();
        const end = nodeToReplace.getEnd();
        
        fileText = fileText.substring(0, start) + replacement + fileText.substring(end);
        
        const fnStart = fn.getStart();
        fileText = fileText.substring(0, fnStart) + schemaStr + "\n" + fileText.substring(fnStart);
        modified = true;
        
        fileText = fileText.replace(/let body:[^;]+;/g, "");
        fileText = fileText.replace(/let body;/g, "");
        continue;
      }
    }
  }

  if (modified) {
    if (!hasZodImport) {
      fileText = `import { z } from "zod";\n` + fileText;
      hasZodImport = true;
    }
    fs.writeFileSync(filePath, fileText);
    console.log("Updated", filePath);
  }
}
