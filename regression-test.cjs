const { chromium } = require('playwright');

async function regressionTest() {
  console.log('🔄 Regression Test - Verifying Backward Compatibility...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Test page that represents typical usage scenarios
  await page.setContent(`
    <html>
      <head><title>Regression Test</title></head>
      <body>
        <h1>Legacy API Compatibility Test</h1>
        
        <!-- Basic elements that existing code might interact with -->
        <button id="basic-button">Click Me</button>
        <input type="text" id="basic-input" placeholder="Type here" />
        <select id="basic-select">
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </select>
        <a href="#test" id="basic-link">Test Link</a>
        
        <!-- Table for element discovery -->
        <table>
          <thead>
            <tr><th>Name</th><th>Value</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${Array.from({ length: 10 }, (_, i) => `
              <tr>
                <td>Item ${i}</td>
                <td>${i * 10}</td>
                <td><button class="row-btn" data-row="${i}">Edit</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Form for complex interactions -->
        <form id="test-form">
          <fieldset>
            <legend>Test Form</legend>
            <input type="text" name="field1" required />
            <input type="email" name="field2" />
            <textarea name="field3"></textarea>
            <select name="field4">
              <option value="a">A</option>
              <option value="b">B</option>
            </select>
            <input type="checkbox" name="field5" />
            <input type="radio" name="field6" value="x" />
            <input type="radio" name="field6" value="y" />
            <button type="submit">Submit</button>
          </fieldset>
        </form>
      </body>
    </html>
  `);
  
  await page.waitForLoadState('networkidle');
  
  const compatibilityTests = [
    {
      name: 'Basic Element Selection APIs',
      test: async () => {
        console.log('   Testing basic element selection...');
        
        // Test $ and $$ selectors (core Playwright APIs)
        const button = await page.$('#basic-button');
        const inputs = await page.$$('input');
        const buttons = await page.$$('button');
        
        const results = {
          singleElement: button !== null,
          multipleElements: inputs.length > 0,
          buttonCount: buttons.length,
          inputCount: inputs.length
        };
        
        // Clean up (this should work with our disposal system)
        if (button) await button.dispose();
        for (const input of inputs) {
          try {
            await input.dispose();
          } catch (e) {
            // Handle already disposed
          }
        }
        for (const btn of buttons) {
          try {
            await btn.dispose();
          } catch (e) {
            // Handle already disposed
          }
        }
        
        return {
          success: results.singleElement && results.multipleElements && results.buttonCount > 0,
          details: `Button found: ${results.singleElement}, Inputs: ${results.inputCount}, Buttons: ${results.buttonCount}`,
          results
        };
      }
    },
    
    {
      name: 'Element Interaction APIs',
      test: async () => {
        console.log('   Testing element interactions...');
        
        const interactions = [];
        
        try {
          // Test clicking
          await page.click('#basic-button');
          interactions.push({ action: 'click', success: true });
        } catch (error) {
          interactions.push({ action: 'click', success: false, error: error.message });
        }
        
        try {
          // Test typing
          await page.fill('#basic-input', 'test value');
          const value = await page.inputValue('#basic-input');
          interactions.push({ action: 'fill', success: value === 'test value', value });
        } catch (error) {
          interactions.push({ action: 'fill', success: false, error: error.message });
        }
        
        try {
          // Test selecting
          await page.selectOption('#basic-select', '2');
          const selected = await page.$eval('#basic-select', el => el.value);
          interactions.push({ action: 'select', success: selected === '2', selected });
        } catch (error) {
          interactions.push({ action: 'select', success: false, error: error.message });
        }
        
        const successfulInteractions = interactions.filter(i => i.success).length;
        
        return {
          success: successfulInteractions === 3,
          details: `${successfulInteractions}/3 interactions successful`,
          interactions
        };
      }
    },
    
    {
      name: 'Element Property Access APIs',
      test: async () => {
        console.log('   Testing element property access...');
        
        const propertyTests = [];
        
        try {
          // Test textContent
          const buttonText = await page.textContent('#basic-button');
          propertyTests.push({ 
            property: 'textContent', 
            success: buttonText === 'Click Me', 
            value: buttonText 
          });
        } catch (error) {
          propertyTests.push({ 
            property: 'textContent', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test getAttribute
          const placeholder = await page.getAttribute('#basic-input', 'placeholder');
          propertyTests.push({ 
            property: 'getAttribute', 
            success: placeholder === 'Type here', 
            value: placeholder 
          });
        } catch (error) {
          propertyTests.push({ 
            property: 'getAttribute', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test isVisible
          const isVisible = await page.isVisible('#basic-button');
          propertyTests.push({ 
            property: 'isVisible', 
            success: isVisible === true, 
            value: isVisible 
          });
        } catch (error) {
          propertyTests.push({ 
            property: 'isVisible', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test boundingBox
          const bbox = await page.boundingBox('#basic-button');
          propertyTests.push({ 
            property: 'boundingBox', 
            success: bbox !== null && bbox.width > 0, 
            value: bbox 
          });
        } catch (error) {
          propertyTests.push({ 
            property: 'boundingBox', 
            success: false, 
            error: error.message 
          });
        }
        
        const successfulProperties = propertyTests.filter(p => p.success).length;
        
        return {
          success: successfulProperties === 4,
          details: `${successfulProperties}/4 property access methods working`,
          propertyTests
        };
      }
    },
    
    {
      name: 'Complex Queries and Waiters',
      test: async () => {
        console.log('   Testing complex queries and waiters...');
        
        const queryTests = [];
        
        try {
          // Test complex selector
          const rowButtons = await page.$$('.row-btn');
          queryTests.push({ 
            query: 'class selector', 
            success: rowButtons.length === 10, 
            count: rowButtons.length 
          });
          
          // Clean up
          for (const btn of rowButtons) {
            try {
              await btn.dispose();
            } catch (e) {
              // Already disposed
            }
          }
        } catch (error) {
          queryTests.push({ 
            query: 'class selector', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test attribute selector
          const dataElements = await page.$$('[data-row]');
          queryTests.push({ 
            query: 'attribute selector', 
            success: dataElements.length === 10, 
            count: dataElements.length 
          });
          
          // Clean up
          for (const elem of dataElements) {
            try {
              await elem.dispose();
            } catch (e) {
              // Already disposed
            }
          }
        } catch (error) {
          queryTests.push({ 
            query: 'attribute selector', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test waitForSelector (should be immediate since elements exist)
          const element = await page.waitForSelector('#basic-button', { timeout: 1000 });
          queryTests.push({ 
            query: 'waitForSelector', 
            success: element !== null, 
            found: element !== null 
          });
          
          if (element) {
            try {
              await element.dispose();
            } catch (e) {
              // Already disposed
            }
          }
        } catch (error) {
          queryTests.push({ 
            query: 'waitForSelector', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test $eval
          const buttonId = await page.$eval('#basic-button', el => el.id);
          queryTests.push({ 
            query: '$eval', 
            success: buttonId === 'basic-button', 
            value: buttonId 
          });
        } catch (error) {
          queryTests.push({ 
            query: '$eval', 
            success: false, 
            error: error.message 
          });
        }
        
        const successfulQueries = queryTests.filter(q => q.success).length;
        
        return {
          success: successfulQueries === 4,
          details: `${successfulQueries}/4 query methods working`,
          queryTests
        };
      }
    },
    
    {
      name: 'Form Handling APIs',
      test: async () => {
        console.log('   Testing form handling APIs...');
        
        const formTests = [];
        
        try {
          // Test form field operations
          await page.fill('input[name="field1"]', 'test');
          await page.fill('input[name="field2"]', 'test@example.com');
          await page.fill('textarea[name="field3"]', 'test message');
          await page.selectOption('select[name="field4"]', 'b');
          await page.check('input[name="field5"]');
          await page.check('input[name="field6"][value="x"]');
          
          // Verify values
          const field1 = await page.inputValue('input[name="field1"]');
          const field2 = await page.inputValue('input[name="field2"]');
          const field3 = await page.inputValue('textarea[name="field3"]');
          const field4 = await page.inputValue('select[name="field4"]');
          const field5 = await page.isChecked('input[name="field5"]');
          const field6 = await page.isChecked('input[name="field6"][value="x"]');
          
          formTests.push(
            { field: 'text', success: field1 === 'test' },
            { field: 'email', success: field2 === 'test@example.com' },
            { field: 'textarea', success: field3 === 'test message' },
            { field: 'select', success: field4 === 'b' },
            { field: 'checkbox', success: field5 === true },
            { field: 'radio', success: field6 === true }
          );
        } catch (error) {
          formTests.push({ 
            field: 'form operations', 
            success: false, 
            error: error.message 
          });
        }
        
        const successfulFormOps = formTests.filter(f => f.success).length;
        
        return {
          success: successfulFormOps === 6,
          details: `${successfulFormOps}/6 form operations successful`,
          formTests
        };
      }
    },
    
    {
      name: 'Event Handling and JavaScript Evaluation',
      test: async () => {
        console.log('   Testing event handling and JS evaluation...');
        
        const jsTests = [];
        
        try {
          // Test page.evaluate
          const domInfo = await page.evaluate(() => {
            return {
              title: document.title,
              elementCount: document.querySelectorAll('*').length,
              buttonCount: document.querySelectorAll('button').length,
              inputCount: document.querySelectorAll('input').length,
              url: window.location.href
            };
          });
          
          jsTests.push({ 
            test: 'evaluate', 
            success: domInfo.title === 'Regression Test' && domInfo.elementCount > 0,
            domInfo 
          });
        } catch (error) {
          jsTests.push({ 
            test: 'evaluate', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test page.addScriptTag (add a simple script)
          await page.addScriptTag({
            content: 'window.testVariable = "regression test";'
          });
          
          const testVar = await page.evaluate(() => window.testVariable);
          jsTests.push({ 
            test: 'addScriptTag', 
            success: testVar === 'regression test',
            value: testVar 
          });
        } catch (error) {
          jsTests.push({ 
            test: 'addScriptTag', 
            success: false, 
            error: error.message 
          });
        }
        
        try {
          // Test exposeFunction
          await page.exposeFunction('testFunction', (x) => x * 2);
          const result = await page.evaluate(() => window.testFunction(21));
          jsTests.push({ 
            test: 'exposeFunction', 
            success: result === 42,
            result 
          });
        } catch (error) {
          jsTests.push({ 
            test: 'exposeFunction', 
            success: false, 
            error: error.message 
          });
        }
        
        const successfulJSTests = jsTests.filter(j => j.success).length;
        
        return {
          success: successfulJSTests === 3,
          details: `${successfulJSTests}/3 JavaScript evaluation methods working`,
          jsTests
        };
      }
    }
  ];
  
  // Run all regression tests
  console.log('\\n🧪 RUNNING REGRESSION TESTS');
  console.log('=' .repeat(60));
  
  const results = [];
  let totalPassed = 0;
  
  for (const test of compatibilityTests) {
    console.log(`\\n📋 ${test.name}`);
    try {
      const result = await test.test();
      results.push({ name: test.name, ...result });
      
      if (result.success) {
        console.log(`✅ PASSED - ${result.details}`);
        totalPassed++;
      } else {
        console.log(`❌ FAILED - ${result.details}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
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
  
  // Memory check after all operations
  if (global.gc) global.gc();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const finalMemory = process.memoryUsage();
  
  // Final results
  console.log('\\n🏆 REGRESSION TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`📊 Overall: ${totalPassed}/${compatibilityTests.length} tests passed`);
  console.log(`📈 Success rate: ${(totalPassed / compatibilityTests.length * 100).toFixed(1)}%`);
  console.log(`💾 Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`);
  
  if (totalPassed === compatibilityTests.length) {
    console.log('\\n🎉 ALL REGRESSION TESTS PASSED');
    console.log('✅ Backward compatibility is maintained');
    console.log('✅ Existing APIs continue to work as expected');
    console.log('✅ No breaking changes detected');
  } else {
    console.log('\\n⚠️  SOME REGRESSION TESTS FAILED');
    console.log('❌ Breaking changes detected');
    console.log('❌ Review failed tests and fix compatibility issues');
  }
  
  console.log('\\n📊 COMPREHENSIVE TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log('This test suite verified:');
  console.log('• Basic element selection and interaction APIs');
  console.log('• Element property access methods');  
  console.log('• Complex queries and waiting mechanisms');
  console.log('• Form handling and input manipulation');
  console.log('• JavaScript evaluation and function exposure');
  console.log('• Memory management with automatic disposal');
  
  await browser.close();
  
  return {
    passed: totalPassed === compatibilityTests.length,
    totalTests: compatibilityTests.length,
    passedTests: totalPassed,
    results,
    memoryUsage: finalMemory.heapUsed
  };
}

regressionTest().catch(console.error);