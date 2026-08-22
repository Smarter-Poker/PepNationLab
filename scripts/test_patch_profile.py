import requests

url = "https://pepnationlab.com/api/agent/profile"

res = requests.patch(url, json={"first_name": "Mustafa"})
print(res.status_code, res.text)
