import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1000, "height": 500})
        await page.goto("http://localhost:3000/admin/savage-labels")
        await page.wait_for_timeout(5000)
        await page.screenshot(path="labels_screenshot.png")
        await browser.close()

asyncio.run(main())
