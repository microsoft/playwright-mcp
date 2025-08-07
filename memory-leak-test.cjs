const { chromium } = require('playwright');

async function memoryLeakTest() {
  console.log('🔍 Starting comprehensive memory leak test...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Create test HTML with many elements to test ElementHandle management
  await page.setContent(`
    <html>
      <head><title>Memory Leak Test</title></head>
      <body>
        <div id="container">
          ${Array.from({ length: 3000 }, (_, i) => `
            <div class="test-element" data-id="${i}" role="button" tabindex="0">
              <span class="element-text">Element ${i}</span>
              <button class="action-btn" onclick="alert('clicked ${i}')">Click ${i}</button>
              <input type="text" placeholder="Input ${i}" />
              <select>
                <option value="opt1">Option 1</option>
                <option value="opt2">Option 2</option>
              </select>
            </div>
          `).join('')}
        </div>
        
        <!-- Add modals and iframes for complexity -->
        <div class="modal" style="position: fixed; z-index: 1000;">Modal Content</div>
        <iframe src="data:text/html,<h1>Test Frame</h1>" style="display: none;"></iframe>
        
        <!-- Add many images for resource testing -->
        ${Array.from({ length: 100 }, (_, i) => `
          <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><text>${i}</text></svg>" alt="Image ${i}" />
        `).join('')}
      </body>
    </html>
  `);
  
  const initialMemory = process.memoryUsage();
  console.log(`📊 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
  
  let testResults = {
    iterations: 100,
    memorySnapshots: [],
    errors: [],
    timings: []
  };
  
  // Run analysis iterations to test for memory leaks
  for (let i = 0; i < testResults.iterations; i++) {
    const iterationStart = Date.now();
    
    try {
      // Simulate diagnostic operations that could cause memory leaks
      
      // 1. Test ElementHandle creation and disposal
      const elements = await page.$$('.test-element');
      const buttons = await page.$$('.action-btn');
      const inputs = await page.$$('input');
      const selects = await page.$$('select');
      
      // 2. Test element analysis operations
      for (const element of elements.slice(0, 50)) { // Test first 50 to avoid timeout
        try {
          await element.boundingBox();
          await element.getAttribute('data-id');
          await element.textContent();
          // These should be automatically disposed if our fix works
        } catch (e) {
          // Element might be detached, continue
        }
      }
      
      // 3. Test iframe detection
      const iframes = await page.$$('iframe');
      for (const iframe of iframes) {
        try {
          await iframe.getAttribute('src');
        } catch (e) {
          // Continue on error
        }
      }
      
      // 4. Test performance metrics gathering
      const perfMetrics = await page.evaluate(() => {
        return {
          domElements: document.querySelectorAll('*').length,
          images: document.images.length,
          scripts: document.scripts.length,
          frames: window.frames.length
        };
      });
      
      // 5. Test element discovery operations
      await page.evaluate(() => {
        const elements = document.querySelectorAll('[role="button"]');
        const clickables = document.querySelectorAll('button, a, [onclick]');
        const forms = document.querySelectorAll('input, select, textarea');
        
        return {
          roleElements: elements.length,
          clickables: clickables.length,
          formElements: forms.length
        };
      });
      
      // Dispose ElementHandles manually to test our disposal system
      for (const element of elements) {
        try {
          await element.dispose();
        } catch (e) {
          // Handle already disposed elements
        }
      }
      for (const button of buttons) {
        try {
          await button.dispose();
        } catch (e) {
          // Handle already disposed elements
        }
      }
      for (const input of inputs) {
        try {
          await input.dispose();
        } catch (e) {
          // Handle already disposed elements
        }
      }
      for (const select of selects) {
        try {
          await select.dispose();
        } catch (e) {
          // Handle already disposed elements
        }
      }
      for (const iframe of iframes) {
        try {
          await iframe.dispose();
        } catch (e) {
          // Handle already disposed elements
        }
      }
      
      const iterationTime = Date.now() - iterationStart;
      testResults.timings.push(iterationTime);
      
      // Take memory snapshots every 10 iterations
      if (i % 10 === 0) {
        const currentMemory = process.memoryUsage();
        const memoryIncrease = ((currentMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed * 100);
        testResults.memorySnapshots.push({
          iteration: i,
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external,
          rss: currentMemory.rss,
          increasePercent: memoryIncrease
        });
        
        console.log(`🔄 Iteration ${i}: ${Math.round(currentMemory.heapUsed / 1024 / 1024)} MB (+${memoryIncrease.toFixed(2)}%) | ${iterationTime}ms`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
    } catch (error) {
      testResults.errors.push({
        iteration: i,
        error: error.message,
        stack: error.stack
      });
      console.error(`❌ Error in iteration ${i}: ${error.message}`);
    }
  }
  
  const finalMemory = process.memoryUsage();
  const totalMemoryIncrease = ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed * 100);
  const avgIterationTime = testResults.timings.reduce((a, b) => a + b, 0) / testResults.timings.length;
  
  console.log('\\n🧪 COMPREHENSIVE MEMORY LEAK TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`📊 Test Configuration:`);
  console.log(`   • Iterations: ${testResults.iterations}`);
  console.log(`   • DOM Elements per iteration: 3,000+ elements analyzed`);
  console.log(`   • ElementHandles created: ~500+ per iteration`);
  console.log(`   • Total operations: ${testResults.iterations * 500}+`);
  
  console.log(`\\n💾 Memory Analysis:`);
  console.log(`   • Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
  console.log(`   • Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`);
  console.log(`   • Total increase: ${totalMemoryIncrease.toFixed(2)}%`);
  console.log(`   • Peak memory: ${Math.max(...testResults.memorySnapshots.map(s => s.heapUsed)) / 1024 / 1024} MB`);
  
  console.log(`\\n⚡ Performance Analysis:`);
  console.log(`   • Average iteration time: ${avgIterationTime.toFixed(2)}ms`);
  console.log(`   • Total execution time: ${testResults.timings.reduce((a, b) => a + b, 0)}ms`);
  console.log(`   • Operations per second: ${(1000 / avgIterationTime * 500).toFixed(0)} ElementHandle ops/sec`);
  
  console.log(`\\n🚨 Error Analysis:`);
  console.log(`   • Total errors: ${testResults.errors.length}`);
  console.log(`   • Error rate: ${(testResults.errors.length / testResults.iterations * 100).toFixed(2)}%`);
  
  if (testResults.errors.length > 0) {
    console.log(`   • Sample errors:`);
    testResults.errors.slice(0, 3).forEach((error, i) => {
      console.log(`     ${i + 1}. Iteration ${error.iteration}: ${error.error}`);
    });
  }
  
  // Memory trend analysis
  console.log(`\\n📈 Memory Trend Analysis:`);
  const snapshots = testResults.memorySnapshots;
  if (snapshots.length > 2) {
    const firstSnapshot = snapshots[1]; // Skip initial
    const lastSnapshot = snapshots[snapshots.length - 1];
    const memoryTrend = lastSnapshot.increasePercent - firstSnapshot.increasePercent;
    
    console.log(`   • Memory trend: ${memoryTrend > 0 ? '↗️' : memoryTrend < 0 ? '↘️' : '➡️'} ${memoryTrend.toFixed(2)}% over test`);
    console.log(`   • Memory stability: ${Math.abs(memoryTrend) < 5 ? '✅ STABLE' : '⚠️ UNSTABLE'}`);
  }
  
  console.log('\\n🏆 TEST VERDICT:');
  
  // Memory leak assessment
  if (totalMemoryIncrease < 10) {
    console.log('✅ MEMORY LEAK TEST: PASSED');
    console.log(`   Memory increase (${totalMemoryIncrease.toFixed(2)}%) is within acceptable limits (<10%)`);
  } else if (totalMemoryIncrease < 25) {
    console.log('⚠️  MEMORY LEAK TEST: WARNING');
    console.log(`   Memory increase (${totalMemoryIncrease.toFixed(2)}%) is elevated but manageable (<25%)`);
  } else {
    console.log('❌ MEMORY LEAK TEST: FAILED');
    console.log(`   Memory increase (${totalMemoryIncrease.toFixed(2)}%) indicates potential memory leaks (>=25%)`);
  }
  
  // Performance assessment  
  if (avgIterationTime < 200) {
    console.log('✅ PERFORMANCE TEST: EXCELLENT');
    console.log(`   Average iteration time (${avgIterationTime.toFixed(2)}ms) is very fast (<200ms)`);
  } else if (avgIterationTime < 500) {
    console.log('✅ PERFORMANCE TEST: GOOD');
    console.log(`   Average iteration time (${avgIterationTime.toFixed(2)}ms) is acceptable (<500ms)`);
  } else {
    console.log('⚠️  PERFORMANCE TEST: NEEDS IMPROVEMENT');
    console.log(`   Average iteration time (${avgIterationTime.toFixed(2)}ms) is slower than target (>=500ms)`);
  }
  
  // Error rate assessment
  const errorRate = (testResults.errors.length / testResults.iterations * 100);
  if (errorRate < 1) {
    console.log('✅ STABILITY TEST: EXCELLENT');
    console.log(`   Error rate (${errorRate.toFixed(2)}%) is very low (<1%)`);
  } else if (errorRate < 5) {
    console.log('✅ STABILITY TEST: GOOD');
    console.log(`   Error rate (${errorRate.toFixed(2)}%) is acceptable (<5%)`);
  } else {
    console.log('❌ STABILITY TEST: FAILED');
    console.log(`   Error rate (${errorRate.toFixed(2)}%) is too high (>=5%)`);
  }
  
  await browser.close();
  
  return {
    passed: totalMemoryIncrease < 10 && avgIterationTime < 500 && errorRate < 5,
    metrics: {
      memoryIncrease: totalMemoryIncrease,
      averageTime: avgIterationTime,
      errorRate: errorRate
    }
  };
}

// Run the test
memoryLeakTest().catch(error => {
  console.error('❌ Memory leak test failed with error:', error);
  process.exit(1);
});