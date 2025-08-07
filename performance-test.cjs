const { chromium } = require('playwright');

async function performanceTest() {
  console.log('⚡ Performance Test for Parallel Analysis...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Create complex test HTML to test parallel processing benefits
  await page.setContent(`
    <html>
      <head>
        <title>Performance Test Page</title>
        <style>
          .fixed { position: fixed; z-index: 1000; }
          .high-z { z-index: 9999; }
          .modal { position: fixed; z-index: 2000; background: rgba(0,0,0,0.5); }
        </style>
      </head>
      <body>
        <!-- Complex DOM structure for testing -->
        <div id="main-container">
          ${Array.from({ length: 500 }, (_, i) => `
            <section class="section-${i % 10}" data-section="${i}">
              <header>
                <h2>Section ${i}</h2>
                <nav>
                  <a href="#link${i}">Link ${i}</a>
                  <button type="button" onclick="handleClick(${i})">Action ${i}</button>
                </nav>
              </header>
              <div class="content">
                <p>Content paragraph ${i} with various <span class="highlight">highlighted</span> text.</p>
                <form id="form-${i}">
                  <input type="text" name="field${i}" placeholder="Field ${i}" />
                  <select name="select${i}">
                    <option value="1">Option 1</option>
                    <option value="2">Option 2</option>
                    <option value="3">Option 3</option>
                  </select>
                  <textarea name="textarea${i}" rows="3">Default text ${i}</textarea>
                  <input type="checkbox" id="check${i}" name="check${i}" />
                  <label for="check${i}">Checkbox ${i}</label>
                </form>
              </div>
              <footer>
                <div class="tags">
                  ${Array.from({ length: 5 }, (_, j) => `<span class="tag tag-${j}">Tag ${j}</span>`).join('')}
                </div>
              </footer>
            </section>
          `).join('')}
        </div>
        
        <!-- Add layout complexity -->
        <div class="fixed header-fixed" style="top: 0; left: 0; right: 0; z-index: 1000;">Fixed Header</div>
        <div class="fixed sidebar-fixed" style="left: 0; top: 50px; bottom: 0; z-index: 999;">Fixed Sidebar</div>
        <div class="modal" id="modal1">Modal 1</div>
        <div class="modal high-z" id="modal2">High Z Modal</div>
        
        <!-- Add iframes for complexity -->
        <iframe src="data:text/html,<h1>Iframe 1</h1><div>Content</div>" style="width: 300px; height: 200px;"></iframe>
        <iframe src="data:text/html,<h1>Iframe 2</h1><form><input type='text'><button>Submit</button></form>" style="width: 300px; height: 200px;"></iframe>
        
        <!-- Add many images -->
        ${Array.from({ length: 50 }, (_, i) => `
          <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23${(i * 123456).toString(16).substr(0,6)}'/><text x='50' y='50' text-anchor='middle' dy='0.3em' fill='white'>${i}</text></svg>" alt="Image ${i}" loading="lazy" />
        `).join('')}
        
        <script>
          function handleClick(id) {
            console.log('Clicked:', id);
          }
          
          // Add some dynamic content
          setTimeout(() => {
            const container = document.getElementById('main-container');
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<p>Dynamically added content</p>';
            container.appendChild(newDiv);
          }, 100);
        </script>
      </body>
    </html>
  `);
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('📊 Page loaded, starting performance measurements...');
  
  // Test various diagnostic operations that should benefit from parallel analysis
  const tests = [
    {
      name: 'DOM Structure Analysis',
      operation: async () => {
        return await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          const depth = Math.max(...Array.from(allElements).map(el => {
            let d = 0;
            let current = el;
            while (current.parentElement) {
              d++;
              current = current.parentElement;
            }
            return d;
          }));
          
          return {
            totalElements: allElements.length,
            maxDepth: depth,
            sections: document.querySelectorAll('section').length,
            forms: document.querySelectorAll('form').length,
            inputs: document.querySelectorAll('input').length
          };
        });
      }
    },
    {
      name: 'Layout Metrics Analysis',
      operation: async () => {
        return await page.evaluate(() => {
          const fixedElements = Array.from(document.querySelectorAll('.fixed')).map(el => {
            const style = window.getComputedStyle(el);
            return {
              position: style.position,
              zIndex: style.zIndex,
              id: el.id || el.className
            };
          });
          
          const highZElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
            return zIndex > 100;
          }).length;
          
          return {
            fixedElements: fixedElements.length,
            highZIndexElements: highZElements,
            modals: document.querySelectorAll('.modal').length
          };
        });
      }
    },
    {
      name: 'Interaction Elements Discovery',
      operation: async () => {
        return await page.evaluate(() => {
          const clickable = document.querySelectorAll('button, a, [onclick], [role="button"]').length;
          const formElements = document.querySelectorAll('input, select, textarea').length;
          const links = document.querySelectorAll('a[href]').length;
          const disabled = document.querySelectorAll(':disabled').length;
          
          return {
            clickableElements: clickable,
            formElements: formElements,
            links: links,
            disabledElements: disabled
          };
        });
      }
    },
    {
      name: 'Resource Detection',
      operation: async () => {
        return await page.evaluate(() => {
          const images = document.images.length;
          const scripts = document.scripts.length;
          const stylesheets = document.querySelectorAll('link[rel="stylesheet"], style').length;
          const iframes = document.querySelectorAll('iframe').length;
          
          return {
            imageCount: images,
            scriptCount: scripts,
            stylesheetCount: stylesheets,
            iframeCount: iframes
          };
        });
      }
    },
    {
      name: 'Element Handle Operations',
      operation: async () => {
        const buttons = await page.$$('button');
        const inputs = await page.$$('input');
        const results = [];
        
        // Test a sample of elements to avoid timeout
        const sampleButtons = buttons.slice(0, 10);
        const sampleInputs = inputs.slice(0, 10);
        
        for (const button of sampleButtons) {
          try {
            const text = await button.textContent();
            const box = await button.boundingBox();
            results.push({ type: 'button', hasText: !!text, hasBounds: !!box });
          } catch (e) {
            results.push({ type: 'button', error: e.message });
          }
        }
        
        for (const input of sampleInputs) {
          try {
            const type = await input.getAttribute('type');
            const placeholder = await input.getAttribute('placeholder');
            results.push({ type: 'input', inputType: type, hasPlaceholder: !!placeholder });
          } catch (e) {
            results.push({ type: 'input', error: e.message });
          }
        }
        
        // Cleanup
        for (const button of buttons) {
          try {
            await button.dispose();
          } catch (e) {
            // Already disposed
          }
        }
        for (const input of inputs) {
          try {
            await input.dispose();
          } catch (e) {
            // Already disposed
          }
        }
        
        return {
          buttonsSampled: sampleButtons.length,
          inputsSampled: sampleInputs.length,
          totalResults: results.length,
          errors: results.filter(r => r.error).length
        };
      }
    }
  ];
  
  const results = {
    individual: [],
    parallel: null,
    sequential: null
  };
  
  // Test individual operations
  console.log('\\n🔍 Testing individual operations...');
  for (const test of tests) {
    const start = Date.now();
    try {
      const result = await test.operation();
      const duration = Date.now() - start;
      results.individual.push({
        name: test.name,
        duration,
        success: true,
        result
      });
      console.log(`   ${test.name}: ${duration}ms ✅`);
    } catch (error) {
      const duration = Date.now() - start;
      results.individual.push({
        name: test.name,
        duration,
        success: false,
        error: error.message
      });
      console.log(`   ${test.name}: ${duration}ms ❌ (${error.message})`);
    }
  }
  
  // Test sequential execution
  console.log('\\n🔄 Testing sequential execution...');
  const sequentialStart = Date.now();
  const sequentialResults = [];
  for (const test of tests) {
    try {
      const result = await test.operation();
      sequentialResults.push({ name: test.name, success: true, result });
    } catch (error) {
      sequentialResults.push({ name: test.name, success: false, error: error.message });
    }
  }
  const sequentialDuration = Date.now() - sequentialStart;
  results.sequential = { duration: sequentialDuration, results: sequentialResults };
  console.log(`   Sequential execution: ${sequentialDuration}ms`);
  
  // Test parallel execution (simulated)
  console.log('\\n⚡ Testing parallel execution...');
  const parallelStart = Date.now();
  const parallelPromises = tests.map(async (test) => {
    try {
      const result = await test.operation();
      return { name: test.name, success: true, result };
    } catch (error) {
      return { name: test.name, success: false, error: error.message };
    }
  });
  
  const parallelResults = await Promise.allSettled(parallelPromises);
  const parallelDuration = Date.now() - parallelStart;
  results.parallel = { 
    duration: parallelDuration, 
    results: parallelResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
  };
  console.log(`   Parallel execution: ${parallelDuration}ms`);
  
  // Analysis
  const totalIndividual = results.individual.reduce((sum, r) => sum + r.duration, 0);
  const performanceImprovement = ((sequentialDuration - parallelDuration) / sequentialDuration * 100);
  
  console.log('\\n📊 PERFORMANCE ANALYSIS RESULTS');
  console.log('=' .repeat(60));
  console.log(`🎯 Target Metrics:`);
  console.log(`   • Basic analysis: < 300ms`);
  console.log(`   • Detailed analysis: < 500ms`);
  console.log(`   • Complete analysis: < 2000ms`);
  
  console.log(`\\n⏱️  Execution Times:`);
  console.log(`   • Individual total: ${totalIndividual}ms`);
  console.log(`   • Sequential: ${sequentialDuration}ms`);  
  console.log(`   • Parallel: ${parallelDuration}ms`);
  console.log(`   • Improvement: ${performanceImprovement.toFixed(1)}%`);
  
  console.log(`\\n🎪 Individual Operation Performance:`);
  results.individual.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const benchmark = result.duration < 300 ? '🎯' : result.duration < 500 ? '⚠️' : '🐌';
    console.log(`   ${benchmark} ${result.name}: ${result.duration}ms ${status}`);
  });
  
  console.log(`\\n🚀 Parallel Processing Analysis:`);
  if (parallelDuration < 500) {
    console.log('✅ PARALLEL PERFORMANCE: EXCELLENT');
    console.log(`   Parallel execution (${parallelDuration}ms) meets detailed analysis target (<500ms)`);
  } else if (parallelDuration < 1000) {
    console.log('✅ PARALLEL PERFORMANCE: GOOD');  
    console.log(`   Parallel execution (${parallelDuration}ms) is acceptable (<1000ms)`);
  } else {
    console.log('⚠️  PARALLEL PERFORMANCE: NEEDS OPTIMIZATION');
    console.log(`   Parallel execution (${parallelDuration}ms) exceeds target (>=1000ms)`);
  }
  
  if (performanceImprovement > 20) {
    console.log('🏆 PARALLEL BENEFIT: SIGNIFICANT');
    console.log(`   ${performanceImprovement.toFixed(1)}% improvement demonstrates effective parallelization`);
  } else if (performanceImprovement > 0) {
    console.log('✅ PARALLEL BENEFIT: POSITIVE');
    console.log(`   ${performanceImprovement.toFixed(1)}% improvement shows parallelization value`);
  } else {
    console.log('❌ PARALLEL BENEFIT: MINIMAL');
    console.log(`   ${performanceImprovement.toFixed(1)}% suggests parallel overhead or contention`);
  }
  
  await browser.close();
  
  return {
    passed: parallelDuration < 500 && performanceImprovement > 0,
    metrics: {
      parallelDuration,
      sequentialDuration,
      improvement: performanceImprovement,
      individualTotal: totalIndividual
    }
  };
}

performanceTest().catch(console.error);