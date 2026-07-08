import requests
import json
import sys
import time

headers = {
    'User-Agent': 'PepNationLabBot/1.0 (research@pepnationlab.com)'
}
S = requests.Session()
S.headers.update(headers)
API_URL = "https://www.wikidata.org/w/api.php"

# Step 1: Get Login Token
res1 = S.get(API_URL, params={
    'action': 'query',
    'meta': 'tokens',
    'type': 'login',
    'format': 'json'
})
login_token = res1.json()['query']['tokens']['logintoken']

# Step 2: Login
res2 = S.post(API_URL, data={
    'action': 'clientlogin',
    'username': 'PepNationLab',
    'password': '215SlalomCt!',
    'loginreturnurl': 'http://127.0.0.1',
    'logintoken': login_token,
    'format': 'json'
})
if res2.json().get('clientlogin', {}).get('status') != 'PASS':
    print("Login failed")
    sys.exit(1)

# Step 3: Get CSRF Token
res3 = S.get(API_URL, params={
    'action': 'query',
    'meta': 'tokens',
    'format': 'json'
})
csrf_token = res3.json()['query']['tokens']['csrftoken']

# Step 4: Define Claims
ITEM = "Q140460136"

def add_claim(prop, value_str):
    data = {
        'action': 'wbcreateclaim',
        'entity': ITEM,
        'snaktype': 'value',
        'property': prop,
        'value': value_str,
        'token': csrf_token,
        'format': 'json'
    }
    res = S.post(API_URL, data=data)
    print(f"Added {prop}:", json.dumps(res.json(), indent=2))
    time.sleep(2)

claims = {
    "P31": json.dumps({"entity-type":"item","numeric-id":194189}),  # instance of: wholesale
    "P17": json.dumps({"entity-type":"item","numeric-id":30}),      # country: USA
    "P2002": '"PepNationLab"',                                      # Twitter
    "P2003": '"pepnationlab"',                                      # Instagram
    "P2397": '"UCvPX1ho_av0jxctz4yER0Og"',                          # YouTube
    "P2013": '"61591787160330"',                                    # Facebook
    "P7085": '"pepnationlab"',                                      # TikTok
    "P3836": '"PepNationLab"',                                      # Pinterest
    "P2088": '"pep-nation-lab"'                                     # Crunchbase
}

for prop, val in claims.items():
    add_claim(prop, val)


