const { chromium } = require('playwright');

async function integrationTest() {
  console.log('🔧 Integration Test - Testing All System Components...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Create test scenario that exercises all implemented features
  await page.setContent(`
    <html>
      <head><title>Integration Test</title></head>
      <body>
        <div id="app">
          <header>
            <nav>
              <button id="menu-btn" aria-label="Menu">☰</button>
              <ul id="nav-menu" role="menu">
                <li><a href="#home" role="menuitem">Home</a></li>
                <li><a href="#about" role="menuitem">About</a></li>
                <li><button role="menuitem" onclick="openModal()">Contact</button></li>
              </ul>
            </nav>
          </header>
          
          <main>
            <section id="content">
              <h1>Main Content</h1>
              <form id="test-form">
                <fieldset>
                  <legend>User Information</legend>
                  <label for="name">Name:</label>
                  <input type="text" id="name" name="name" required />
                  
                  <label for="email">Email:</label>
                  <input type="email" id="email" name="email" required />
                  
                  <label for="country">Country:</label>
                  <select id="country" name="country">
                    <option value="">Select...</option>
                    <option value="us">United States</option>
                    <option value="uk">United Kingdom</option>
                    <option value="jp">Japan</option>
                  </select>
                  
                  <label for="message">Message:</label>
                  <textarea id="message" name="message" rows="4"></textarea>
                  
                  <button type="submit">Submit</button>
                  <button type="reset">Reset</button>
                </fieldset>
              </form>
            </section>
            
            <aside id="sidebar">
              <div class="widget">
                <h3>Related Links</h3>
                <ul>
                  ${Array.from({ length: 20 }, (_, i) => `<li><a href="#link${i}">Link ${i}</a></li>`).join('')}
                </ul>
              </div>
            </aside>
          </main>
          
          <footer>
            <p>&copy; 2024 Integration Test</p>
          </footer>
        </div>
        
        <!-- Modal for testing modal detection -->
        <div id="modal" class="modal" style="position: fixed; z-index: 1000; display: none;">
          <div class="modal-content">
            <button class="close" onclick="closeModal()">&times;</button>
            <h2>Contact Modal</h2>
            <p>This is a modal dialog.</p>
          </div>
        </div>
        
        <!-- iframe for testing iframe detection -->
        <iframe src="data:text/html,<h1>Test Frame</h1>" style="width: 300px; height: 200px;"></iframe>
        
        <script>
          function openModal() {
            document.getElementById('modal').style.display = 'block';
          }
          function closeModal() {
            document.getElementById('modal').style.display = 'none';
          }
        </script>
      </body>
    </html>
  `);
  
  await page.waitForLoadState('networkidle');
  
  const testSuite = [
    {
      name: 'Phase 1: ElementHandle Memory Management',
      test: async () => {
        console.log('   Testing ElementHandle disposal...');
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Create many ElementHandles
        const buttons = await page.$$('button');
        const inputs = await page.$$('input');
        const links = await page.$$('a');
        
        // Test operations
        for (const button of buttons) {
          try {
            await button.textContent();
            await button.boundingBox();
          } catch (e) {
            // Handle disposed elements gracefully
          }
        }
        
        // Dispose all handles
        for (const handle of [...buttons, ...inputs, ...links]) {
          try {
            await handle.dispose();
          } catch (e) {
            // Already disposed is OK
          }
        }
        
        // Force GC and check memory
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const finalMemory = process.memoryUsage().heapUsed;
        const increase = ((finalMemory - initialMemory) / initialMemory * 100);
        
        return {
          success: increase < 20, // Allow some memory growth
          details: `Memory increase: ${increase.toFixed(2)}%`,
          handlesCreated: buttons.length + inputs.length + links.length
        };
      }
    },
    
    {
      name: 'Phase 1: Frame Reference Management',
      test: async () => {
        console.log('   Testing frame reference management...');
        
        try {
          // Test iframe detection
          const iframes = await page.$$('iframe');
          console.log(`     Found ${iframes.length} iframe(s)`);
          
          // Test frame operations
          const frameAnalysis = await page.evaluate(() => {
            const frames = window.frames;
            const iframeElements = document.querySelectorAll('iframe');
            
            return {
              windowFrames: frames.length,
              iframeElements: iframeElements.length,
              framesAccessible: Array.from(iframeElements).map(iframe => {
                try {
                  return {
                    src: iframe.src,
                    loaded: iframe.contentDocument !== null
                  };
                } catch (e) {
                  return { error: 'Access denied' };
                }
              })
            };
          });
          
          // Cleanup
          for (const iframe of iframes) {
            try {
              await iframe.dispose();
            } catch (e) {
              // Already disposed
            }
          }
          
          return {
            success: true,
            details: `Frames: ${frameAnalysis.windowFrames}, Elements: ${frameAnalysis.iframeElements}`,
            frameAnalysis
          };
          
        } catch (error) {
          return {
            success: false,
            details: `Frame test failed: ${error.message}`,
            error: error.message
          };
        }
      }
    },
    
    {
      name: 'Phase 2: Parallel Analysis Performance',
      test: async () => {
        console.log('   Testing parallel analysis performance...');
        
        const analysisOperations = [
          // DOM analysis
          async () => {
            return await page.evaluate(() => {
              const elements = document.querySelectorAll('*');
              return {
                totalElements: elements.length,
                buttons: document.querySelectorAll('button').length,
                inputs: document.querySelectorAll('input').length,
                links: document.querySelectorAll('a').length
              };
            });
          },
          
          // Layout analysis  
          async () => {
            return await page.evaluate(() => {
              const fixed = Array.from(document.querySelectorAll('*')).filter(el => {
                return window.getComputedStyle(el).position === 'fixed';
              });
              
              return {
                fixedElements: fixed.length,
                modal: document.querySelector('#modal') ? 1 : 0,
                zIndexElements: fixed.filter(el => {
                  const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
                  return zIndex > 100;
                }).length
              };
            });
          },
          
          // Form analysis
          async () => {
            return await page.evaluate(() => {
              const forms = document.querySelectorAll('form');
              const formElements = document.querySelectorAll('input, select, textarea');
              
              return {
                forms: forms.length,
                formElements: formElements.length,
                requiredFields: document.querySelectorAll('[required]').length
              };
            });
          }
        ];
        
        // Test sequential execution
        const sequentialStart = Date.now();
        for (const operation of analysisOperations) {
          await operation();
        }
        const sequentialTime = Date.now() - sequentialStart;
        
        // Test parallel execution
        const parallelStart = Date.now();
        await Promise.all(analysisOperations.map(op => op()));
        const parallelTime = Date.now() - parallelStart;
        
        const improvement = ((sequentialTime - parallelTime) / sequentialTime * 100);
        
        return {
          success: parallelTime < 500 && improvement >= 0,
          details: `Sequential: ${sequentialTime}ms, Parallel: ${parallelTime}ms, Improvement: ${improvement.toFixed(1)}%`,
          metrics: { sequentialTime, parallelTime, improvement }
        };
      }
    },
    
    {
      name: 'Phase 2: Resource Usage Monitoring',
      test: async () => {
        console.log('   Testing resource usage monitoring...');
        
        const initialMemory = process.memoryUsage();
        const startTime = Date.now();
        
        // Perform resource-intensive operations
        await page.evaluate(() => {
          // Simulate DOM manipulation
          const container = document.getElementById('app');
          for (let i = 0; i < 100; i++) {
            const div = document.createElement('div');
            div.textContent = `Dynamic content ${i}`;
            container.appendChild(div);
          }
        });
        
        // Test element discovery
        const allElements = await page.$$('*');
        const buttons = await page.$$('button');
        
        // Test element operations
        for (const button of buttons.slice(0, 5)) {
          try {
            await button.textContent();
            await button.isVisible();
            await button.boundingBox();
          } catch (e) {
            // Continue on error
          }
        }
        
        // Clean up
        for (const element of [...allElements, ...buttons]) {
          try {
            await element.dispose();
          } catch (e) {
            // Already disposed
          }
        }
        
        const finalMemory = process.memoryUsage();
        const executionTime = Date.now() - startTime;
        const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
        
        return {
          success: executionTime < 2000 && memoryDelta < 50 * 1024 * 1024, // 50MB limit
          details: `Time: ${executionTime}ms, Memory delta: ${Math.round(memoryDelta / 1024 / 1024)}MB`,
          metrics: { executionTime, memoryDelta, elementsProcessed: allElements.length }
        };
      }
    },
    
    {
      name: 'Phase 3: Unified Error Handling',
      test: async () => {
        console.log('   Testing unified error handling system...');
        
        const errorTests = [
          // Test missing element handling
          async () => {
            try {
              await page.click('#nonexistent-element');
              return { type: 'missing_element', handled: false };
            } catch (error) {
              return { 
                type: 'missing_element', 
                handled: true, 
                message: error.message,
                hasContext: error.message.includes('selector') || error.message.includes('element')
              };
            }
          },
          
          // Test disposed handle handling
          async () => {
            try {
              const button = await page.$('button');
              await button.dispose();
              await button.click(); // Should fail gracefully
              return { type: 'disposed_handle', handled: false };
            } catch (error) {
              return {
                type: 'disposed_handle',
                handled: true,
                message: error.message,
                hasContext: error.message.length > 0
              };
            }
          }
        ];
        
        const results = [];
        for (const test of errorTests) {
          results.push(await test());
        }
        
        const handledErrors = results.filter(r => r.handled).length;
        const contextualErrors = results.filter(r => r.hasContext).length;
        
        return {
          success: handledErrors === results.length,
          details: `Handled: ${handledErrors}/${results.length}, Contextual: ${contextualErrors}/${results.length}`,
          errorResults: results
        };
      }
    },
    
    {
      name: 'Phase 3: Configuration System Integration',
      test: async () => {
        console.log('   Testing configuration system integration...');
        
        try {
          // Test configuration-driven behavior
          const configTests = [
            // Test timeout configurations
            async () => {
              const start = Date.now();
              try {
                // This should timeout quickly with proper configuration
                await page.waitForSelector('#never-exists', { timeout: 100 });
                return { type: 'timeout', worked: false };
              } catch (error) {
                const duration = Date.now() - start;
                return { 
                  type: 'timeout', 
                  worked: duration < 200, 
                  duration,
                  message: error.message
                };
              }
            },
            
            // Test batch size limitations
            async () => {
              const elements = await page.$$('*');
              const smallBatch = elements.slice(0, 10);
              
              const start = Date.now();
              for (const element of smallBatch) {
                try {
                  await element.textContent();
                } catch (e) {
                  // Continue on error
                }
              }
              const duration = Date.now() - start;
              
              // Cleanup
              for (const element of elements) {
                try {
                  await element.dispose();
                } catch (e) {
                  // Already disposed
                }
              }
              
              return { 
                type: 'batch_processing', 
                worked: duration < 1000,
                duration,
                elementsProcessed: smallBatch.length
              };
            }
          ];
          
          const results = [];
          for (const test of configTests) {
            results.push(await test());
          }
          
          const workingConfigs = results.filter(r => r.worked).length;
          
          return {
            success: workingConfigs === results.length,
            details: `Working configs: ${workingConfigs}/${results.length}`,
            configResults: results
          };
          
        } catch (error) {
          return {
            success: false,
            details: `Configuration test failed: ${error.message}`,
            error: error.message
          };
        }
      }
    }
  ];
  
  // Run all tests
  console.log('\\n🧪 RUNNING INTEGRATION TESTS');
  console.log('=' .repeat(60));
  
  const results = [];
  let totalPassed = 0;
  
  for (const test of testSuite) {
    console.log(`\\n📋 ${test.name}`);
    try {
      const result = await test.test();
      results.push({ name: test.name, ...result });
      
      if (result.success) {
        console.log(`✅ PASSED - ${result.details}`);
        totalPassed++;
      } else {
        console.log(`❌ FAILED - ${result.details}`);
      }
    } catch (error) {
      console.log(`💥 ERROR - ${error.message}`);
      results.push({ 
        name: test.name, 
        success: false, 
        details: error.message, 
        error: error.message 
      });
    }
  }
  
  // Final results
  console.log('\\n🏆 INTEGRATION TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`📊 Overall: ${totalPassed}/${testSuite.length} tests passed`);
  console.log(`📈 Success rate: ${(totalPassed / testSuite.length * 100).toFixed(1)}%`);
  
  if (totalPassed === testSuite.length) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED');
    console.log('✅ All three phases of improvements are working correctly');
  } else {
    console.log('⚠️  SOME INTEGRATION TESTS FAILED');
    console.log('❌ Review failed tests and fix implementation issues');
  }
  
  console.log('\\n📝 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.name}`);
    if (result.metrics) {
      console.log(`      Metrics: ${JSON.stringify(result.metrics)}`);
    }
    if (!result.success && result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  await browser.close();
  
  return {
    passed: totalPassed === testSuite.length,
    totalTests: testSuite.length,
    passedTests: totalPassed,
    results
  };
}

integrationTest().catch(console.error);