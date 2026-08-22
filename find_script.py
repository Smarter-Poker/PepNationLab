import json

transcript_path = '/Users/smarter.poker/.gemini/antigravity/brain/5704cc86-3c79-46da-8052-0defc4900d3b/.system_generated/logs/transcript_full.jsonl'

with open(transcript_path, 'r') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'RUN_COMMAND' and 'first3_final' in data.get('content', ''):
            print(data['content'][:500])
            print("===========================")
