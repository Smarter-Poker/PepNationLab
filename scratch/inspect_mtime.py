import os

base_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images"

files = []
for root, dirs, filenames in os.walk(base_dir):
    for filename in filenames:
        filepath = os.path.join(root, filename)
        files.append((filepath, os.path.getmtime(filepath), os.path.getsize(filepath)))

files.sort(key=lambda x: x[1], reverse=True)

print("Recently modified files under public/images:")
for f in files[:20]:
    rel_path = os.path.relpath(f[0], "/Users/smarter.poker/Documents/pepnationlab")
    print(f"{rel_path}: size={f[2]} bytes, mtime={f[1]}")
