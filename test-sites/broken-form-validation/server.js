import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
    try {
        // Determine root directory based on environment
        const rootDir = IS_PRODUCTION && existsSync(join(__dirname, 'dist')) 
            ? join(__dirname, 'dist')
            : __dirname;
        
        // Simple routing
        let filePath = req.url === '/' ? '/index.html' : req.url;
        const fullPath = join(rootDir, filePath);
        
        // Security: Prevent directory traversal
        if (!fullPath.startsWith(rootDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        
        const content = await readFile(fullPath);
        const ext = extname(fullPath);
        const contentType = MIME_TYPES[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

server.listen(PORT, () => {
    const mode = IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT';
    console.log(`\n🚀 Server running in ${mode} mode at http://localhost:${PORT}`);
    
    if (IS_PRODUCTION && existsSync(join(__dirname, 'dist'))) {
        console.log('📦 Serving minified production build from /dist');
    } else if (IS_PRODUCTION) {
        console.log('⚠️  Production mode but no /dist folder found. Run "npm run build" first!');
    } else {
        console.log('🔧 Serving development files');
    }
    
    console.log('\n📋 Known bugs in this test site:');
    console.log('  1. Form submit button doesn\'t work (wrong event listener)');
    console.log('  2. Email validation accepts invalid emails');
    console.log('  3. Password confirmation always passes');
    console.log('  4. Age validation uses string comparison');
    console.log('  5. Success message doesn\'t show (typo in code)');
    console.log('  6. Error highlighting doesn\'t work properly');
    console.log('\nPress Ctrl+C to stop the server\n');
});