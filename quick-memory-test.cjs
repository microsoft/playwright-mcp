const { chromium } = require('playwright');

async function quickMemoryTest() {
  console.log('🔍 Quick Memory Leak Test...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Create simpler test HTML
  await page.setContent(`
    <html>
      <body>
        <div id="container">
          ${Array.from({ length: 1000 }, (_, i) => `
            <div class="test-element" data-id="${i}">
              <button onclick="alert('${i}')">Button ${i}</button>
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `);
  
  const initialMemory = process.memoryUsage();
  console.log(`📊 Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
  
  // Test ElementHandle creation/disposal 50 times
  for (let i = 0; i < 50; i++) {
    try {
      const elements = await page.$$('.test-element');
      const buttons = await page.$$('button');
      
      // Test basic operations
      for (const element of elements.slice(0, 10)) {
        try {
          await element.textContent();
          await element.boundingBox();
        } catch (e) {
          // Continue on error
        }
      }
      
      // Dispose handles
      for (const element of elements) {
        try {
          await element.dispose();
        } catch (e) {
          // Already disposed
        }
      }
      for (const button of buttons) {
        try {
          await button.dispose();
        } catch (e) {
          // Already disposed
        }
      }
      
      if (i % 10 === 0) {
        const current = process.memoryUsage();
        const increase = ((current.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed * 100);
        console.log(`🔄 ${i}: ${Math.round(current.heapUsed / 1024 / 1024)} MB (+${increase.toFixed(1)}%)`);
        
        if (global.gc) global.gc();
      }
      
    } catch (error) {
      console.error(`❌ Error ${i}: ${error.message}`);
    }
  }
  
  // Final measurement
  if (global.gc) global.gc();
  await new Promise(resolve => setTimeout(resolve, 100)); // Let GC settle
  
  const finalMemory = process.memoryUsage();
  const totalIncrease = ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed * 100);
  
  console.log(`\\n📊 RESULTS:`);
  console.log(`   Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
  console.log(`   Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`);
  console.log(`   Increase: ${totalIncrease.toFixed(2)}%`);
  
  if (totalIncrease < 15) {
    console.log('✅ MEMORY TEST PASSED - No significant leaks detected');
  } else if (totalIncrease < 50) {
    console.log('⚠️  MEMORY TEST WARNING - Moderate memory increase');  
  } else {
    console.log('❌ MEMORY TEST FAILED - Significant memory leak detected');
  }
  
  await browser.close();
  return totalIncrease < 15;
}

quickMemoryTest().catch(console.error);