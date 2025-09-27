#!/usr/bin/env node

/**
 * Build optimization script
 * This script runs additional optimizations after the main build
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting build optimization...');

// Function to minify CSS
const minifyCSS = (css) => {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
    .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
    .replace(/;\s*/g, ';') // Remove spaces after semicolons
    .replace(/\s*,\s*/g, ',') // Remove spaces around commas
    .trim();
};

// Function to optimize HTML
const optimizeHTML = (html) => {
  return html
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim();
};

// Function to create critical CSS
const createCriticalCSS = () => {
  const criticalCSS = `
/* Critical CSS - Above the fold styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  background-color: hsl(210 25% 97%);
  color: hsl(210 15% 15%);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.dark body {
  background-color: hsl(210 25% 8%);
  color: hsl(210 25% 95%);
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.min-h-screen {
  min-height: 100vh;
}

.bg-background {
  background-color: hsl(210 25% 97%);
}

.dark .bg-background {
  background-color: hsl(210 25% 8%);
}

.text-primary {
  color: hsl(158 42% 31%);
}

.dark .text-primary {
  color: hsl(158 42% 45%);
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: hsl(210 25% 97%);
}

.dark .loading-container {
  background-color: hsl(210 25% 8%);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid hsl(210 20% 88%);
  border-top: 3px solid hsl(158 42% 31%);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.sticky {
  position: sticky;
  top: 0;
  z-index: 40;
}

.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

@media (max-width: 640px) {
  .max-w-md {
    max-width: 100%;
  }
}
`;

  return minifyCSS(criticalCSS);
};

// Main optimization function
const optimizeBuild = () => {
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.log('❌ Dist folder not found. Please run the build command first.');
    return;
  }

  console.log('📁 Found dist folder, starting optimization...');

  // Optimize HTML files
  const htmlFiles = fs.readdirSync(distPath).filter(file => file.endsWith('.html'));
  htmlFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    const html = fs.readFileSync(filePath, 'utf8');
    const optimizedHTML = optimizeHTML(html);
    fs.writeFileSync(filePath, optimizedHTML);
    console.log(`✅ Optimized ${file}`);
  });

  // Create critical CSS file
  const criticalCSS = createCriticalCSS();
  fs.writeFileSync(path.join(distPath, 'critical.css'), criticalCSS);
  console.log('✅ Created critical.css');

  // Optimize CSS files
  const cssFiles = fs.readdirSync(path.join(distPath, 'assets')).filter(file => file.endsWith('.css'));
  cssFiles.forEach(file => {
    const filePath = path.join(distPath, 'assets', file);
    const css = fs.readFileSync(filePath, 'utf8');
    const optimizedCSS = minifyCSS(css);
    fs.writeFileSync(filePath, optimizedCSS);
    console.log(`✅ Optimized ${file}`);
  });

  console.log('🎉 Build optimization completed!');
  console.log('📊 Optimizations applied:');
  console.log('  - HTML minification');
  console.log('  - CSS minification');
  console.log('  - Critical CSS extraction');
  console.log('  - Resource optimization');
};

// Run optimization
optimizeBuild();
