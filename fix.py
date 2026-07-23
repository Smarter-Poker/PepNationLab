import os, re

for root, _, files in os.walk('./app/admin'):
    for f in files:
        if f.endswith('page.tsx'):
            path = os.path.join(root, f)
            with open(path, 'r') as file: content = file.read()
            orig = content
            
            # select('role') -> select('role, is_admin_account')
            content = re.sub(r"\.select\(\s*['\`\"](.*?role.*?)['\`\"]\s*\)", lambda m: f".select('{m.group(1)}, is_admin_account')" if 'is_admin_account' not in m.group(1) else m.group(0), content)
            
            # isEffectiveAdmin(user.id, profile?.role) -> && profile?.is_admin_account !== true
            content = re.sub(
                r'(!isEffectiveAdmin\(\s*user\.id\s*,\s*([a-zA-Z0-9_\?\.]*?(?:profile|me|prof)[a-zA-Z0-9_\?\.]*)\s*\))',
                lambda m: f"{m.group(1)} && {m.group(2).split('?')[0].split('.')[0].replace('(','').replace(' as any','')}.is_admin_account !== true",
                content
            )

            # Fix specific case for (profile as { role?: string } | null)?.role
            content = re.sub(
                r'!isEffectiveAdmin\(\s*user\.id\s*,\s*\(\s*profile\s*as\s*[^)]+\s*\)\?\.role\s*\)',
                r'!isEffectiveAdmin(user.id, (profile as any)?.role) && (profile as any)?.is_admin_account !== true',
                content
            )
            
            if content != orig:
                with open(path, 'w') as file: file.write(content)
                print('Updated', path)
