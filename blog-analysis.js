// Blog Analysis Script using Puppeteer
import puppeteer from 'puppeteer';

async function analyzeBlog() {
  console.log('🚀 Starting blog analysis...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Show the browser for debugging
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('📱 Navigating to blog...');
    await page.goto('http://localhost:3000/blog', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Wait for content to load
    await page.waitForSelector('h1', { timeout: 5000 });
    
    console.log('📊 Analyzing page structure...');
    
    // Get page title and basic info
    const title = await page.title();
    const url = page.url();
    
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);
    
    // Analyze the page structure
    const analysis = await page.evaluate(() => {
      const results = {
        headers: [],
        blogPosts: [],
        navigation: [],
        styling: {},
        accessibility: {},
        performance: {}
      };
      
      // Get all headers
      const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      results.headers = Array.from(headers).map(h => ({
        tag: h.tagName,
        text: h.textContent.trim(),
        classes: h.className
      }));
      
      // Analyze blog posts
      const postElements = document.querySelectorAll('[class*="bg-white"][class*="rounded"]');
      results.blogPosts = Array.from(postElements).map((post, index) => {
        const title = post.querySelector('h3');
        const date = post.querySelector('p');
        const description = post.querySelectorAll('p')[2]; // Third p tag should be description
        
        return {
          index,
          title: title?.textContent?.trim() || 'No title',
          date: date?.textContent?.trim() || 'No date',
          description: description?.textContent?.trim() || 'No description',
          hasHover: post.className.includes('hover:'),
          classes: post.className
        };
      });
      
      // Check navigation elements
      const navElements = document.querySelectorAll('a, button');
      results.navigation = Array.from(navElements).map(nav => ({
        text: nav.textContent.trim(),
        href: nav.href || 'button',
        classes: nav.className
      }));
      
      // Analyze styling
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      results.styling = {
        backgroundColor: computedStyle.backgroundColor,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        lineHeight: computedStyle.lineHeight
      };
      
      // Check accessibility
      results.accessibility = {
        hasAltTexts: document.querySelectorAll('img[alt]').length,
        totalImages: document.querySelectorAll('img').length,
        hasSkipLinks: document.querySelectorAll('[href*="#"]').length,
        focusableElements: document.querySelectorAll('a, button, input, textarea, select, [tabindex]').length
      };
      
      // Performance indicators
      results.performance = {
        totalElements: document.querySelectorAll('*').length,
        totalImages: document.querySelectorAll('img').length,
        totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
        totalScripts: document.querySelectorAll('script').length
      };
      
      return results;
    });
    
    console.log('\n📋 BLOG ANALYSIS RESULTS:');
    console.log('========================');
    
    console.log('\n🎯 Headers:');
    analysis.headers.forEach(h => {
      console.log(`  ${h.tag}: "${h.text}"`);
    });
    
    console.log('\n📝 Blog Posts Found:');
    analysis.blogPosts.forEach(post => {
      console.log(`  ${post.index + 1}. "${post.title}"`);
      console.log(`     Date: ${post.date}`);
      console.log(`     Hover Effects: ${post.hasHover ? '✅' : '❌'}`);
    });
    
    console.log('\n🧭 Navigation Elements:');
    analysis.navigation.forEach(nav => {
      if (nav.text && nav.text.length > 0) {
        console.log(`  "${nav.text}" -> ${nav.href}`);
      }
    });
    
    console.log('\n🎨 Styling Analysis:');
    console.log(`  Background: ${analysis.styling.backgroundColor}`);
    console.log(`  Font Family: ${analysis.styling.fontFamily}`);
    console.log(`  Font Size: ${analysis.styling.fontSize}`);
    
    console.log('\n♿ Accessibility Check:');
    console.log(`  Images with alt text: ${analysis.accessibility.hasAltTexts}/${analysis.accessibility.totalImages}`);
    console.log(`  Focusable elements: ${analysis.accessibility.focusableElements}`);
    
    console.log('\n⚡ Performance Overview:');
    console.log(`  Total DOM elements: ${analysis.performance.totalElements}`);
    console.log(`  Images: ${analysis.performance.totalImages}`);
    console.log(`  Stylesheets: ${analysis.performance.totalStylesheets}`);
    
    // Take a screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ 
      path: 'blog-screenshot.png', 
      fullPage: true 
    });
    
    // Test responsiveness
    console.log('\n📱 Testing mobile responsiveness...');
    await page.setViewport({ width: 375, height: 667 }); // iPhone SE
    await page.screenshot({ 
      path: 'blog-mobile-screenshot.png', 
      fullPage: true 
    });
    
    // Test clicking on a blog post
    console.log('\n🖱️ Testing blog post interaction...');
    await page.setViewport({ width: 1920, height: 1080 }); // Back to desktop
    
    // Wait a moment for any transitions
    await page.waitForTimeout(1000);
    
    const firstPost = await page.$('h3');
    if (firstPost) {
      await firstPost.click();
      await page.waitForTimeout(2000); // Wait for content to load
      
      // Check if we're now viewing a post
      const postView = await page.evaluate(() => {
        const backButton = document.querySelector('button, a');
        const content = document.querySelector('article, .prose');
        return {
          hasBackButton: !!backButton,
          hasContent: !!content,
          backButtonText: backButton?.textContent?.trim()
        };
      });
      
      console.log('\n📄 Post View Analysis:');
      console.log(`  Back button found: ${postView.hasBackButton ? '✅' : '❌'}`);
      console.log(`  Back button text: "${postView.backButtonText}"`);
      console.log(`  Article content: ${postView.hasContent ? '✅' : '❌'}`);
      
      await page.screenshot({ 
        path: 'blog-post-view-screenshot.png', 
        fullPage: true 
      });
    }
    
    console.log('\n✅ Analysis complete! Screenshots saved:');
    console.log('  - blog-screenshot.png (desktop view)');
    console.log('  - blog-mobile-screenshot.png (mobile view)');
    console.log('  - blog-post-view-screenshot.png (individual post view)');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.log('\n💡 Make sure your dev server is running:');
      console.log('   npm run dev');
      console.log('   Then try again!');
    }
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeBlog().then(() => {
  console.log('\n🎉 Blog analysis completed!');
}).catch(error => {
  console.error('💥 Analysis failed:', error);
});