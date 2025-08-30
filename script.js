class DNSLookup {
    constructor() {
        this.form = document.getElementById('dnsForm');
        this.domainInput = document.getElementById('domain');
        this.lookupBtn = document.getElementById('lookupBtn');
        this.loading = document.getElementById('loading');
        this.error = document.getElementById('error');
        this.results = document.getElementById('results');
        this.controls = document.getElementById('controls');
        this.domainName = document.getElementById('domainName');
        this.errorMessage = document.getElementById('errorMessage');
        this.downloadCsvBtn = document.getElementById('downloadCsv');
        this.themeToggle = document.getElementById('themeToggle');
        this.recordCount = document.getElementById('recordCount');
        this.lastUpdated = document.getElementById('lastUpdated');
        this.dnsTable = document.getElementById('dnsTable');
        this.dnsTableBody = document.getElementById('dnsTableBody');
        
        // Record containers
        this.aRecords = document.getElementById('aRecords');
        this.aaaaRecords = document.getElementById('aaaaRecords');
        this.mxRecords = document.getElementById('mxRecords');
        this.nsRecords = document.getElementById('nsRecords');
        this.txtRecords = document.getElementById('txtRecords');
        this.cnameRecords = document.getElementById('cnameRecords');
        
        // Record sections
        this.aSection = document.getElementById('aSection');
        this.aaaaSection = document.getElementById('aaaaSection');
        this.mxSection = document.getElementById('mxSection');
        this.nsSection = document.getElementById('nsSection');
        this.txtSection = document.getElementById('txtSection');
        this.cnameSection = document.getElementById('cnameSection');
        
        this.currentDomain = '';
        this.currentRecords = {
            A: [],
            AAAA: [],
            MX: [],
            NS: [],
            TXT: [],
            CNAME: []
        };
        
        this.initEventListeners();
        this.initTheme();
    }
    
    initTheme() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('dns-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    initEventListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.performLookup();
        });
        
        this.domainInput.addEventListener('input', () => {
            this.hideError();
        });
        
        this.downloadCsvBtn.addEventListener('click', () => {
            this.downloadCSV();
        });
        
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('dns-theme', newTheme);
    }
    
    sanitizeInput(input) {
        // Remove any potentially dangerous characters and scripts
        return input.replace(/[<>"'&]/g, '').trim();
    }
    
    validateDomain(domain) {
        // Sanitize input first
        domain = this.sanitizeInput(domain);
        
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(xn--[a-zA-Z0-9]+|[a-zA-Z]{2,})$/;
        
        if (!domain || domain === '') {
            return { valid: false, message: 'Please enter a domain name.' };
        }
        
        domain = domain.toLowerCase();
        
        // Additional security checks
        if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
            return { valid: false, message: 'Invalid domain format.' };
        }
        
        if (domain.length > 253) {
            return { valid: false, message: 'Domain name is too long (max 253 characters).' };
        }
        
        if (domain.length < 3) {
            return { valid: false, message: 'Domain name is too short (min 3 characters).' };
        }
        
        // Check for suspicious patterns
        const suspiciousPatterns = [/javascript:/i, /data:/i, /vbscript:/i, /file:/i];
        if (suspiciousPatterns.some(pattern => pattern.test(domain))) {
            return { valid: false, message: 'Invalid domain format.' };
        }
        
        if (!domainRegex.test(domain)) {
            return { valid: false, message: 'Invalid domain name format.' };
        }
        
        return { valid: true, domain };
    }
    
    async performLookup() {
        const domain = this.domainInput.value;
        const validation = this.validateDomain(domain);
        
        if (!validation.valid) {
            this.showError(validation.message);
            return;
        }
        
        this.showLoading();
        
        try {
            const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
            const promises = recordTypes.map(type => this.queryDNS(validation.domain, type));
            const results = await Promise.all(promises);
            
            this.currentDomain = validation.domain;
            recordTypes.forEach((type, index) => {
                this.currentRecords[type] = results[index];
            });
            
            this.displayResults(validation.domain);
        } catch (error) {
            this.showError(`DNS lookup failed: ${error.message}`);
        }
    }
    
    async queryDNS(domain, type) {
        try {
            const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/dns-json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`DNS query failed (${response.status}): ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid DNS response format');
            }
            
            if (data.Status !== 0) {
                return [];
            }
            
            const typeMap = {
                'A': 1,
                'AAAA': 28,
                'MX': 15,
                'NS': 2,
                'TXT': 16,
                'CNAME': 5
            };
            
            const records = data.Answer ? data.Answer.filter(record => 
                record && record.type === typeMap[type] && record.data && record.TTL
            ) : [];
            
            return records;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('DNS query timed out. Please try again.');
            }
            throw error;
        }
    }
    
    displayResults(domain) {
        this.hideLoading();
        this.hideError();
        
        this.domainName.textContent = domain;
        
        // Update metadata
        const totalRecords = Object.values(this.currentRecords).reduce((sum, records) => sum + records.length, 0);
        this.recordCount.textContent = `${totalRecords} records found`;
        this.lastUpdated.textContent = `Updated: ${new Date().toLocaleString()}`;
        
        // Populate professional table
        this.populateTable();
        
        // Display each record type in cards
        this.displayRecordType('A', this.aRecords);
        this.displayRecordType('AAAA', this.aaaaRecords);
        this.displayRecordType('MX', this.mxRecords);
        this.displayRecordType('NS', this.nsRecords);
        this.displayRecordType('TXT', this.txtRecords);
        this.displayRecordType('CNAME', this.cnameRecords);
        
        this.results.classList.remove('hidden');
        this.controls.classList.remove('hidden');
        this.downloadCsvBtn.disabled = false;
    }
    
    populateTable() {
        this.dnsTableBody.innerHTML = '';
        
        Object.keys(this.currentRecords).forEach(type => {
            this.currentRecords[type].forEach(record => {
                const row = document.createElement('tr');
                
                let value = record.data;
                let priority = '-';
                
                // Format different record types
                if (type === 'MX') {
                    const parts = record.data.split(' ');
                    if (parts.length >= 2) {
                        priority = parts[0];
                        value = parts.slice(1).join(' ');
                    }
                } else if (type === 'TXT') {
                    value = record.data.replace(/^"|"$/g, '');
                    if (value.length > 50) {
                        value = value.substring(0, 50) + '...';
                    }
                }
                
                // Safely create table cells to prevent XSS
                const typeCell = document.createElement('td');
                const typeBadge = document.createElement('span');
                typeBadge.className = `record-type-badge type-${type.toLowerCase()}`;
                typeBadge.textContent = type;
                typeCell.appendChild(typeBadge);
                
                const valueCell = document.createElement('td');
                valueCell.className = 'record-value';
                valueCell.title = this.sanitizeInput(record.data);
                valueCell.textContent = this.sanitizeInput(value);
                
                // Ensure text doesn't overflow
                if (value.length > 50) {
                    valueCell.textContent = this.sanitizeInput(value.substring(0, 47)) + '...';
                    valueCell.title = this.sanitizeInput(record.data);
                }
                
                const ttlCell = document.createElement('td');
                ttlCell.className = 'ttl-value';
                ttlCell.textContent = `${record.TTL}s`;
                
                const priorityCell = document.createElement('td');
                priorityCell.className = 'priority-value';
                priorityCell.textContent = priority;
                
                const statusCell = document.createElement('td');
                const statusBadge = document.createElement('span');
                statusBadge.className = 'status-badge status-active';
                statusBadge.textContent = '✓ Active';
                statusCell.appendChild(statusBadge);
                
                row.appendChild(typeCell);
                row.appendChild(valueCell);
                row.appendChild(ttlCell);
                row.appendChild(priorityCell);
                row.appendChild(statusCell);
                
                this.dnsTableBody.appendChild(row);
            });
        });
    }
    
    displayRecordType(type, container) {
        container.innerHTML = '';
        const records = this.currentRecords[type];
        
        if (records.length > 0) {
            records.forEach(record => {
                const recordDiv = document.createElement('div');
                recordDiv.className = 'record-item';
                
                const valueDiv = document.createElement('div');
                valueDiv.className = 'record-value';
                
                let displayValue = record.data;
                
                // Format different record types
                if (type === 'MX') {
                    // MX records have priority and exchange
                    const parts = record.data.split(' ');
                    if (parts.length >= 2) {
                        displayValue = `${parts.slice(1).join(' ')} (Priority: ${parts[0]})`;
                    }
                } else if (type === 'TXT') {
                    // Clean up TXT records (remove quotes)
                    displayValue = record.data.replace(/^"|"$/g, '');
                }
                
                valueDiv.textContent = displayValue;
                
                const metaDiv = document.createElement('div');
                metaDiv.className = 'record-meta';
                
                const ttlSpan = document.createElement('span');
                ttlSpan.textContent = `TTL: ${record.TTL}s`;
                
                const typeSpan = document.createElement('span');
                typeSpan.textContent = type;
                
                metaDiv.appendChild(typeSpan);
                metaDiv.appendChild(ttlSpan);
                
                recordDiv.appendChild(valueDiv);
                recordDiv.appendChild(metaDiv);
                
                recordDiv.dataset.type = type;
                recordDiv.dataset.value = displayValue;
                recordDiv.dataset.ttl = record.TTL;
                
                container.appendChild(recordDiv);
            });
        } else {
            const noRecords = document.createElement('div');
            noRecords.className = 'no-records';
            noRecords.textContent = `No ${type} records found.`;
            container.appendChild(noRecords);
        }
    }
    

    
    downloadCSV() {
        if (!this.currentDomain) return;
        
        const csvData = [];
        csvData.push(['Domain', 'Record Type', 'Value', 'TTL', 'Timestamp']);
        
        const timestamp = new Date().toISOString();
        
        // Add records for each enabled type
        Object.keys(this.currentRecords).forEach(type => {
            const toggle = document.getElementById(`show${type}`);
            if (toggle && toggle.checked) {
                this.currentRecords[type].forEach(record => {
                    let value = record.data;
                    
                    // Format values for CSV
                    if (type === 'MX') {
                        const parts = record.data.split(' ');
                        if (parts.length >= 2) {
                            value = `${parts.slice(1).join(' ')} (Priority: ${parts[0]})`;
                        }
                    } else if (type === 'TXT') {
                        value = record.data.replace(/^"|"$/g, '');
                    }
                    
                    csvData.push([this.currentDomain, type, value, record.TTL, timestamp]);
                });
            }
        });
        
        // Convert to CSV string
        const csvString = csvData.map(row => 
            row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        // Create and download file
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `dns-records-${this.currentDomain}-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }
    
    showLoading() {
        this.loading.classList.remove('hidden');
        this.results.classList.add('hidden');
        this.controls.classList.add('hidden');
        this.error.classList.add('hidden');
        this.lookupBtn.disabled = true;
        this.lookupBtn.textContent = 'Looking up...';
    }
    
    hideLoading() {
        this.loading.classList.add('hidden');
        this.lookupBtn.disabled = false;
        this.lookupBtn.textContent = 'Lookup DNS';
    }
    
    showError(message) {
        this.hideLoading();
        this.errorMessage.textContent = message;
        this.error.classList.remove('hidden');
        this.results.classList.add('hidden');
        this.controls.classList.add('hidden');
    }
    
    hideError() {
        this.error.classList.add('hidden');
    }
}

// Initialize the DNS lookup tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DNSLookup();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to perform lookup
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const form = document.getElementById('dnsForm');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to clear search
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('recordSearch');
            if (searchInput && searchInput === document.activeElement) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        }
    });
    
    // Add focus management
    const domainInput = document.getElementById('domain');
    if (domainInput) {
        domainInput.focus();
        
        // Auto-select text when focused
        domainInput.addEventListener('focus', () => {
            setTimeout(() => domainInput.select(), 0);
        });
    }
});