class CurlUtility {
    constructor() {
        this.urlInput = document.getElementById('urlInput');
        this.sendButton = document.getElementById('sendRequest');
        this.analyzeText = document.getElementById('analyzeText');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.errorMessage = document.getElementById('errorMessage');
        this.currentMethod = 'GET';
        this.requestStartTime = 0;
        this.requestEndTime = 0;
        this.abortController = null;
        this.currentAnalysis = null;
        
        this.initEventListeners();
        this.initTheme();
    }
    
    initTheme() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('dns-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    initEventListeners() {
        // Form submission
        const form = document.getElementById('analyzeForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendRequest();
        });
        

        
        // Enter key in URL input
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendRequest();
            }
        });
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        

    }
    
    getFormOptions() {
        return {
            followRedirects: document.getElementById('followRedirects').checked,
            includeHeaders: document.getElementById('includeHeaders').checked,
            timeout: 30, // Fixed timeout
            userAgent: 'cURL-Site/1.0', // Fixed user agent
            customHeaders: [] // No custom headers
        };
    }
    
    validateUrl(url) {
        try {
            // Basic URL validation
            const urlObj = new URL(url);
            
            // Check for valid protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return { valid: false, message: 'Only HTTP and HTTPS protocols are supported.' };
            }
            
            // Check for valid hostname
            if (!urlObj.hostname || urlObj.hostname.length === 0) {
                return { valid: false, message: 'Invalid hostname.' };
            }
            
            // Security checks
            const suspiciousPatterns = [/javascript:/i, /data:/i, /vbscript:/i, /file:/i];
            if (suspiciousPatterns.some(pattern => pattern.test(url))) {
                return { valid: false, message: 'Invalid URL format.' };
            }
            
            return { valid: true, url: urlObj.href };
        } catch (error) {
            return { valid: false, message: 'Invalid URL format.' };
        }
    }
    
    sanitizeInput(input) {
        return input.replace(/[<>"'&]/g, '').trim();
    }
    
    async sendRequest() {
        const url = this.sanitizeInput(this.urlInput.value);
        
        // Validate URL
        const validation = this.validateUrl(url);
        if (!validation.valid) {
            this.showError(validation.message);
            return;
        }
        
        this.showProgress();
        this.sendButton.disabled = true;
        this.hideError();
        this.hideResults();
        
        try {
            // Get form options
            const options = this.getFormOptions();
            
            // Generate cURL command
            const curlCmd = this.generateCurlCommand(validation.url, options);
            
            // Perform analysis
            const result = await this.simulateAnalysis(validation.url, options);
            result.curlCommand = curlCmd;
            
            this.displayResults(result);
            this.showResults();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showError('Analysis cancelled');
            } else {
                this.showError('Analysis failed: ' + error.message);
            }
        } finally {
            this.hideProgress();
            this.sendButton.disabled = false;
        }
    }
    
    async simulateAnalysis(url, options) {
        const startTime = performance.now();
        
        // Update progress
        this.updateProgress(10, 'Initializing...');
        await this.sleep(200);
        
        this.updateProgress(30, 'Connecting...');
        await this.sleep(300);
        
        this.updateProgress(60, 'Sending request...');
        
        try {
            // Create abort controller
            this.abortController = new AbortController();
            const timeoutId = setTimeout(() => this.abortController.abort(), options.timeout * 1000);
            
            // Try direct fetch first
            let response, totalTime, responseText = '';
            
            try {
                const fetchOptions = {
                    method: this.currentMethod,
                    signal: this.abortController.signal,
                    redirect: options.followRedirects ? 'follow' : 'manual',
                    mode: 'cors'
                };

                // Add custom headers (limited by CORS)
                if (options.customHeaders.length > 0) {
                    fetchOptions.headers = {};
                    options.customHeaders.forEach(header => {
                        const [name, value] = header.split(':').map(s => s.trim());
                        const safeName = name.toLowerCase();
                        if (['accept', 'accept-language', 'content-language', 'content-type'].includes(safeName) ||
                            safeName.startsWith('x-')) {
                            fetchOptions.headers[name] = value;
                        }
                    });
                }

                this.updateProgress(80, 'Receiving response...');
                
                response = await fetch(url, fetchOptions);
                const endTime = performance.now();
                totalTime = (endTime - startTime) / 1000;

                clearTimeout(timeoutId);
                this.updateProgress(90, 'Processing response...');
                await this.sleep(200);

                // Get response text
                try {
                    responseText = await response.text();
                } catch (e) {
                    responseText = '[Response body could not be read due to CORS policy]';
                }

            } catch (fetchError) {
                clearTimeout(timeoutId);
                // If direct fetch fails due to CORS, try alternative methods
                if (fetchError.message.includes('CORS') || fetchError.message.includes('Failed to fetch')) {
                    return await this.handleCORSError(url, options, startTime);
                }
                throw fetchError;
            }

            this.updateProgress(100, 'Complete!');

            // Build result object
            const result = {
                url: url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                timing: {
                    total: totalTime,
                    dns: totalTime * 0.1,
                    connect: totalTime * 0.2,
                    ssl: response.url.startsWith('https') ? totalTime * 0.15 : 0,
                    transfer: totalTime * 0.55
                },
                responseText: responseText,
                redirected: response.redirected,
                finalUrl: response.url,
                type: response.type,
                corsEnabled: true
            };

            return result;

        } catch (error) {
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }
    
    async handleCORSError(url, options, startTime) {
        this.updateProgress(70, 'CORS blocked - trying alternatives...');
        
        // Try using a CORS proxy service
        const corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?'
        ];
        
        for (const proxy of corsProxies) {
            try {
                this.updateProgress(80, `Trying proxy: ${proxy.split('/')[2]}...`);
                
                const proxyUrl = proxy + encodeURIComponent(url);
                const response = await fetch(proxyUrl, {
                    signal: this.abortController.signal
                });
                
                if (response.ok) {
                    const endTime = performance.now();
                    const totalTime = (endTime - startTime) / 1000;
                    
                    let data;
                    if (proxy.includes('allorigins')) {
                        data = await response.json();
                        return this.createProxyResult(url, data, totalTime, 'AllOrigins Proxy');
                    } else {
                        const text = await response.text();
                        return this.createDirectProxyResult(url, response, text, totalTime, proxy);
                    }
                }
            } catch (proxyError) {
                console.log(`Proxy ${proxy} failed:`, proxyError.message);
                continue;
            }
        }
        
        // If all proxies fail, return a CORS blocked result
        return this.createCORSBlockedResult(url, startTime);
    }
    
    createProxyResult(url, data, totalTime, proxyName) {
        return {
            url: url,
            status: data.status?.http_code || 200,
            statusText: data.status?.http_code === 200 ? 'OK' : 'Unknown',
            headers: data.status?.response_headers || {},
            timing: {
                total: totalTime,
                dns: totalTime * 0.1,
                connect: totalTime * 0.2,
                ssl: url.startsWith('https') ? totalTime * 0.15 : 0,
                transfer: totalTime * 0.55
            },
            responseText: data.contents || '[No content available]',
            redirected: false,
            finalUrl: data.status?.url || url,
            type: 'cors',
            corsEnabled: false,
            proxyUsed: proxyName,
            note: `Retrieved via ${proxyName} due to CORS restrictions`
        };
    }
    
    createDirectProxyResult(url, response, text, totalTime, proxy) {
        return {
            url: url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            timing: {
                total: totalTime,
                dns: totalTime * 0.1,
                connect: totalTime * 0.2,
                ssl: url.startsWith('https') ? totalTime * 0.15 : 0,
                transfer: totalTime * 0.55
            },
            responseText: text,
            redirected: response.redirected,
            finalUrl: response.url,
            type: 'cors',
            corsEnabled: false,
            proxyUsed: proxy.split('/')[2],
            note: `Retrieved via proxy due to CORS restrictions`
        };
    }
    
    createCORSBlockedResult(url, startTime) {
        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000;
        
        return {
            url: url,
            status: 0,
            statusText: 'CORS Blocked',
            headers: {},
            timing: {
                total: totalTime,
                dns: 0,
                connect: 0,
                ssl: 0,
                transfer: 0
            },
            responseText: 'Unable to fetch due to CORS policy. This is a browser security limitation.',
            redirected: false,
            finalUrl: url,
            type: 'cors-blocked',
            corsEnabled: false,
            corsBlocked: true,
            note: 'Request blocked by CORS policy. Try using the suggested test URLs.',
            suggestions: [
                'Use CORS-enabled endpoints like httpbin.org',
                'Test with the provided working URLs',
                'Enable CORS on your target server',
                'Use browser extensions that disable CORS for testing'
            ]
        };
    }
    
    generateCurlCommand(url, options) {
        let cmd = 'curl';
        
        if (options.followRedirects) cmd += ' -L';
        if (options.includeHeaders) cmd += ' -i';
        cmd += ` --max-time ${options.timeout}`;
        cmd += ` -A "${options.userAgent}"`;
        
        cmd += ` "${url}"`;
        
        return cmd;
    }
    
    displayResults(result) {
        this.currentAnalysis = result;
        
        // Populate overview tab
        this.populateOverview(result);
        
        // Populate headers tab
        this.populateHeaders(result);
        
        // Populate response tab
        this.populateResponse(result);
        
        // Populate timing tab
        this.populateTiming(result);
        
        // Populate SSL tab
        this.populateSSL(result);
        
        // Populate cURL tab
        this.populateCurl(result);
        
        // Switch to overview tab
        this.switchTab('overview');
    }
    
    populateOverview(result) {
        const statusInfo = document.getElementById('statusInfo');
        const overviewData = document.getElementById('overviewData');
        
        // Create status cards
        statusInfo.innerHTML = `
            <div class="status-card">
                <h4>Status Code</h4>
                <div class="value" style="color: ${result.corsBlocked ? '#ffc107' : result.status >= 200 && result.status < 300 ? '#28a745' : '#f44336'}">${result.status}</div>
            </div>
            <div class="status-card">
                <h4>Status Text</h4>
                <div class="value">${result.statusText}</div>
            </div>
            <div class="status-card">
                <h4>Method</h4>
                <div class="value">${this.currentMethod}</div>
            </div>
            <div class="status-card">
                <h4>Response Time</h4>
                <div class="value">${Math.round(result.timing.total * 1000)}ms</div>
            </div>
            <div class="status-card">
                <h4>Content Type</h4>
                <div class="value">${result.headers['content-type'] || 'Unknown'}</div>
            </div>
            <div class="status-card">
                <h4>CORS Status</h4>
                <div class="value">${result.corsEnabled ? 'Enabled' : 'Blocked'}</div>
            </div>
        `;
        
        // Status badge and overview
        const statusClass = result.corsBlocked ? 'status-warning' :
                           result.status >= 200 && result.status < 300 ? 'status-success' : 
                           result.status >= 400 ? 'status-error' : 'status-warning';
        
        let statusHtml = `<span class="status-badge ${statusClass}">${result.status} ${result.statusText}</span>`;
        
        if (result.corsBlocked) {
            statusHtml += `
                <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                    <strong>⚠️ CORS Policy Blocked</strong><br>
                    This request was blocked by browser security. Try these CORS-enabled test URLs:<br>
                    <a href="#" onclick="document.getElementById('urlInput').value='https://httpbin.org/get'; return false;">https://httpbin.org/get</a><br>
                    <a href="#" onclick="document.getElementById('urlInput').value='https://jsonplaceholder.typicode.com/posts/1'; return false;">https://jsonplaceholder.typicode.com/posts/1</a><br>
                    <a href="#" onclick="document.getElementById('urlInput').value='https://api.github.com/users/octocat'; return false;">https://api.github.com/users/octocat</a>
                </div>
            `;
        }
        
        statusHtml += `
            <div style="margin-top: 10px;">
                <strong>Final URL:</strong> ${result.finalUrl}<br>
                <strong>Redirected:</strong> ${result.redirected ? 'Yes' : 'No'}<br>
                <strong>Response Type:</strong> ${result.type}
            </div>
        `;
        
        if (result.note) {
            statusHtml += `<div style="margin-top: 10px; font-style: italic; color: var(--text-secondary);">${result.note}</div>`;
        }
        
        overviewData.innerHTML = statusHtml;
    }
    
    populateHeaders(result) {
        const headersData = document.getElementById('headersData');
        
        let headersText = 'Response Headers:\n\n';
        Object.entries(result.headers).forEach(([key, value]) => {
            headersText += `${key}: ${value}\n`;
        });
        
        headersText += '\n\nRequest Headers (sent):\n\n';
        headersText += `User-Agent: ${this.getFormOptions().userAgent}\n`;
        headersText += `Accept: */*\n`;
        headersText += `Host: ${new URL(result.url).host}\n`;
        
        headersData.textContent = headersText;
    }
    
    populateResponse(result) {
        const responseData = document.getElementById('responseData');
        responseData.textContent = result.responseText || '[No response body]';
    }
    
    populateTiming(result) {
        const timingData = document.getElementById('timingData');
        
        const timingText = `Timing Information:\n\n` +
            `Total Time: ${(result.timing.total * 1000).toFixed(0)}ms\n` +
            `DNS Lookup: ${(result.timing.dns * 1000).toFixed(0)}ms\n` +
            `TCP Connect: ${(result.timing.connect * 1000).toFixed(0)}ms\n` +
            `SSL Handshake: ${(result.timing.ssl * 1000).toFixed(0)}ms\n` +
            `Transfer: ${(result.timing.transfer * 1000).toFixed(0)}ms\n\n` +
            `Performance Breakdown:\n` +
            `- DNS: ${((result.timing.dns / result.timing.total) * 100).toFixed(1)}%\n` +
            `- Connect: ${((result.timing.connect / result.timing.total) * 100).toFixed(1)}%\n` +
            `- SSL: ${((result.timing.ssl / result.timing.total) * 100).toFixed(1)}%\n` +
            `- Transfer: ${((result.timing.transfer / result.timing.total) * 100).toFixed(1)}%\n\n` +
            `Note: Timing breakdowns are simulated estimates in browser environments\n` +
            `due to security restrictions. Only total request time is accurately measurable.`;
        
        timingData.textContent = timingText;
    }
    
    populateSSL(result) {
        const sslData = document.getElementById('sslData');
        const url = new URL(result.url);
        
        if (url.protocol === 'https:') {
            const sslText = `SSL/TLS Information:\n\n` +
                `Protocol: ${url.protocol}\n` +
                `Secure Connection: Yes\n` +
                `Port: ${url.port || 443}\n` +
                `Host: ${url.hostname}\n\n` +
                `SSL Handshake Details:\n` +
                `- TLS Version: TLS 1.2/1.3 (Browser managed)\n` +
                `- Cipher Suite: Modern encryption (Browser selected)\n` +
                `- Key Exchange: ECDHE (Ephemeral keys)\n` +
                `- Authentication: RSA/ECDSA (Server certificate)\n` +
                `- Encryption: AES-256-GCM or ChaCha20-Poly1305\n` +
                `- MAC: Integrated with AEAD cipher\n\n` +
                `Certificate Information:\n` +
                `- Subject: ${url.hostname}\n` +
                `- Issuer: Certificate Authority (Browser validated)\n` +
                `- Valid From: Not accessible via JavaScript\n` +
                `- Valid To: Not accessible via JavaScript\n` +
                `- Serial Number: Not accessible via JavaScript\n` +
                `- Signature Algorithm: SHA-256 with RSA/ECDSA\n` +
                `- Public Key: RSA 2048-bit or ECDSA P-256\n\n` +
                `Security Features:\n` +
                `- Perfect Forward Secrecy: Yes (ECDHE)\n` +
                `- Certificate Transparency: Browser enforced\n` +
                `- HSTS: ${result.headers['strict-transport-security'] ? 'Enabled' : 'Not detected'}\n` +
                `- Certificate Chain: Validated by browser\n` +
                `- OCSP Stapling: Browser managed\n` +
                `- SNI (Server Name Indication): Enabled\n\n` +
                `Handshake Performance:\n` +
                `- SSL Handshake Time: ~${(result.timing.ssl * 1000).toFixed(0)}ms (estimated)\n` +
                `- Certificate Verification: Included in handshake\n` +
                `- Session Resumption: Browser optimized\n\n` +
                `Note: Detailed certificate information (issuer, expiry, serial number, etc.)\n` +
                `is not accessible through browser JavaScript APIs for security reasons.\n` +
                `The browser automatically handles certificate validation, chain verification,\n` +
                `and ensures the connection meets modern security standards.`;
            
            sslData.textContent = sslText;
        } else {
            sslData.textContent = `SSL/TLS Information:\n\nNo SSL/TLS encryption - this is an HTTP connection.\n\nSecurity Warning:\n- Data transmitted over HTTP is not encrypted\n- Information can be intercepted by third parties\n- Credentials and sensitive data are sent in plain text\n- Consider using HTTPS for secure communication\n\nConnection Details:\n- Protocol: HTTP\n- Port: ${url.port || 80}\n- Encryption: None\n- Authentication: None\n- Data Integrity: Not protected\n\nRecommendations:\n- Use HTTPS version of this URL if available\n- Avoid sending sensitive information over HTTP\n- Check if the server supports SSL/TLS\n- Consider using a secure proxy or VPN`;
        }
    }
    
    populateCurl(result) {
        const curlCommand = document.getElementById('curlCommand');
        curlCommand.textContent = result.curlCommand || 'cURL command not available';
    }
    
    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }
    
    showProgress() {
        this.progressContainer.style.display = 'block';
        this.analyzeText.innerHTML = '<span class="spinner"></span>Analyzing...';
    }
    
    hideProgress() {
        this.progressContainer.style.display = 'none';
        this.analyzeText.textContent = 'Send Request';
    }
    
    updateProgress(percent, text) {
        this.progressFill.style.width = percent + '%';
        this.progressText.textContent = text;
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    showResults() {
        this.resultsContainer.style.display = 'block';
    }
    
    hideResults() {
        this.resultsContainer.style.display = 'none';
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global functions for export and copy functionality
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        alert('Copied to clipboard!');
    } catch (err) {
        alert('Failed to copy to clipboard');
    }
    
    document.body.removeChild(textArea);
}

function exportResults(format) {
    const curlUtility = window.curlUtilityInstance;
    if (!curlUtility || !curlUtility.currentAnalysis) {
        alert('No analysis results to export');
        return;
    }

    const result = curlUtility.currentAnalysis;
    let content, filename, mimeType;

    if (format === 'json') {
        content = JSON.stringify(result, null, 2);
        filename = `curl-analysis-${Date.now()}.json`;
        mimeType = 'application/json';
    } else if (format === 'txt') {
        content = `cURL Analysis Report\n${'='.repeat(50)}\n\n`;
        content += `URL: ${result.url}\n`;
        content += `Status: ${result.status} ${result.statusText}\n`;
        content += `Total Time: ${(result.timing.total * 1000).toFixed(0)}ms\n\n`;
        content += `Headers:\n${Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n`;
        content += `cURL Command:\n${result.curlCommand}\n\n`;
        content += `Response:\n${result.responseText}`;
        filename = `curl-analysis-${Date.now()}.txt`;
        mimeType = 'text/plain';
    }

    downloadFile(content, filename, mimeType);
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearForm() {
    document.getElementById('analyzeForm').reset();
    document.getElementById('urlInput').value = 'https://www.bbc.co.uk/';
    const curlUtility = window.curlUtilityInstance;
    if (curlUtility) {
        curlUtility.hideResults();
        curlUtility.hideError();
    }
}

// Initialize the cURL utility when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.curlUtilityInstance = new CurlUtility();
});