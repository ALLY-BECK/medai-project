const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

  await page.goto('http://127.0.0.1:5500/');
  
  // Click patient role
  await page.evaluate(() => {
    document.querySelector('[data-role="patient"]').click();
  });
  
  // Type email and password
  await page.type('#auth-email', 'test_patient2@medai.kz');
  await page.type('#auth-password', 'password123');
  
  // Click login
  await page.click('#login-btn');
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Current URL:", page.url());
  console.log("Dashboard visible:", await page.evaluate(() => document.getElementById('page-patient-dashboard').style.display !== 'none'));
  
  await browser.close();
})();
