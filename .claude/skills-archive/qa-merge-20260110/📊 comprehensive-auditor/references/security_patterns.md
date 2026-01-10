# Security Vulnerability Patterns

This document catalogues security vulnerability patterns detected by the Comprehensive Auditor and provides guidance on mitigation.

## Critical Vulnerabilities

### SQL Injection (Critical)
**Patterns Detected:**
- String concatenation in database queries
- Dynamic SQL construction with user input
- Parameterized queries missing

**Example Code:**
```javascript
// VULNERABLE: String concatenation
const query = `SELECT * FROM users WHERE id = ${userId}`;

// VULNERABLE: Dynamic SQL
db.query(`SELECT * FROM products WHERE name = '${productName}'`);
```

**Mitigation:**
```javascript
// SECURE: Parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// SECURE: ORM with automatic escaping
const users = await User.findAll({
  where: { id: userId }
});
```

### Command Injection (Critical)
**Patterns Detected:**
- exec(), system(), shell_exec() with user input
- subprocess.call() with shell=True
- eval() with dynamic content

**Example Code:**
```python
# VULNERABLE: Command injection
command = f"ls {user_input}"
os.system(command)

# VULNERABLE: Shell injection
subprocess.call(command, shell=True)
```

**Mitigation:**
```python
# SECURE: Argument validation
import shlex
allowed_files = ['file1.txt', 'file2.txt']

if user_input in allowed_files:
    command = ['ls', user_input]
    subprocess.run(command)  # No shell=True
```

### Hardcoded Secrets (High)
**Patterns Detected:**
- API keys in source code
- Database connection strings with passwords
- Private keys or tokens

**Example Code:**
```javascript
// VULNERABLE: Hardcoded API key
const apiKey = "AIzaSyABC123XYZ456...";  // Google API key

// VULNERABLE: Database credentials
const dbUrl = "postgresql://user:password123@localhost:5432/db";
```

**Mitigation:**
```javascript
// SECURE: Environment variables
const apiKey = process.env.GOOGLE_API_KEY;
const dbUrl = process.env.DATABASE_URL;

// SECURE: Configuration file outside repository
const config = require('./config.json');
```

## High Severity Vulnerabilities

### Cross-Site Scripting (XSS) (High)
**Patterns Detected:**
- innerHTML with user input
- eval() with dynamic content
- document.write() with variables

**Example Code:**
```javascript
// VULNERABLE: XSS via innerHTML
element.innerHTML = `<div>User: ${userName}</div>`;

// VULNERABLE: eval() injection
eval(`alert(${userMessage})`);
```

**Mitigation:**
```javascript
// SECURE: Text content or escaping
element.textContent = `User: ${userName}`;
// or
element.innerHTML = escapeHtml(`User: ${userName}`);

// SECURE: Avoid eval when possible
// Use proper function calls instead of eval
```

### Path Traversal (High)
**Patterns Detected:**
- File path concatenation with user input
- Directory traversal sequences (../)
- Unrestricted file access

**Example Code:**
```javascript
// VULNERABLE: Path traversal
const filePath = `./uploads/${userInput}`;
fs.readFile(filePath, callback);
```

**Mitigation:**
```javascript
// SECURE: Path validation
const path = require('path');
const safePath = path.join('./uploads', path.basename(userInput));
fs.readFile(safePath, callback);

// SECURE: Whitelist approach
const allowedFiles = ['profile.jpg', 'document.pdf'];
if (allowedFiles.includes(userInput)) {
  const filePath = path.join('./uploads', userInput);
  fs.readFile(filePath, callback);
}
```

### Insecure Cryptographic Algorithms (High)
**Patterns Detected:**
- MD5, SHA1 for security purposes
- DES, RC4 for encryption
- Weak random number generation

**Example Code:**
```javascript
// VULNERABLE: Weak hashing
const hash = crypto.createHash('md5').update(password).digest('hex');

// VULNERABLE: Insecure encryption
const encrypted = crypto.createCipher('des', key).update(data, 'utf8');

// VULNERABLE: Predictable randomness
const random = Math.random().toString(36);
```

**Mitigation:**
```javascript
// SECURE: Strong hashing
const hash = crypto.createHash('sha256').update(password).digest('hex');

// SECURE: Modern encryption
const crypto = require('crypto');
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

// SECURE: Secure randomness
const random = crypto.randomBytes(32).toString('hex');
```

## Medium Severity Vulnerabilities

### Authentication Issues (Medium)
**Patterns Detected:**
- Plain text password comparison
- Missing rate limiting
- Insecure session management
- Lack of CSRF protection

**Example Code:**
```javascript
// VULNERABLE: Plain text password
if (inputPassword === storedPassword) {
  // Authentication logic
}

// VULNERABLE: No rate limiting
app.post('/login', (req, res) => {
  // No rate limiting implemented
});
```

**Mitigation:**
```javascript
// SECURE: Hashed passwords
const bcrypt = require('bcrypt');
if (await bcrypt.compare(inputPassword, storedHash)) {
  // Authentication logic
}

// SECURE: Rate limiting
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts'
});

app.post('/login', loginLimiter, (req, res) => {
  // Login logic with rate limiting
});
```

### Debug Code in Production (Low)
**Patterns Detected:**
- console.log() statements
- debugger statements
- alert() calls
- Development mode flags

**Example Code:**
```javascript
// VULNERABLE: Debug information leakage
console.log('User data:', userData);
debugger;
alert('Debug: ' + systemInfo);
```

**Mitigation:**
```javascript
// SECURE: Conditional logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', userData);
}

// SECURE: Use proper logging library
const logger = require('winston');
logger.info('User action', { userId: userData.id });

// Remove all debugger statements before production
```

## OWASP Top 10 Mapping

| OWASP Category | Detected Patterns | Severity |
|----------------|-------------------|----------|
| A01: Broken Access Control | Missing auth, no rate limiting | High |
| A02: Cryptographic Failures | Weak crypto, hardcoded keys | Critical |
| A03: Injection | SQL, Command, XPath injection | Critical |
| A04: Insecure Design | Debug code, insecure defaults | Medium |
| A05: Security Misconfiguration | Config files with secrets | High |
| A06: Vulnerable Components | Dependency vulnerabilities | High |
| A07: ID & Authentication Failures | Plain text passwords | High |
| A08: Software & Data Integrity | Missing CSRF protection | Medium |
| A09: Logging & Monitoring | Insufficient logging | Low |
| A10: Server-Side Request Forgery | SSRF patterns | Medium |

## Dependency Vulnerability Detection

### npm audit (Node.js)
**Detects:**
- Known CVEs in npm packages
- Outdated packages with security issues
- Optional dependencies with vulnerabilities

**Usage:**
```bash
npm audit --json
npm audit fix  # Automatic fixes
npm audit fix --force  # Force fixes (use with caution)
```

### Safety (Python)
**Detects:**
- Known Python package vulnerabilities
- Security advisories from PyPI
- CVE information for Python packages

**Usage:**
```bash
safety check --json
pip install --upgrade package-name  # Update vulnerable packages
```

### OWASP Dependency Check
**Detects:**
- Vulnerabilities across multiple languages
- CVE database integration
- CVSS scoring for vulnerabilities

**Usage:**
```bash
dependency-check --project . --format JSON
dependency-check --project . --update-only  # Update database only
```

## Secure Coding Guidelines

### Input Validation
1. **Never trust user input** - Always validate and sanitize
2. **Use parameterized queries** - Prevent injection attacks
3. **Implement allow-lists** - Restrict to known safe values
4. **Length validation** - Limit input length to prevent DoS

### Authentication & Authorization
1. **Use strong hashing** - bcrypt, scrypt, Argon2 for passwords
2. **Implement rate limiting** - Prevent brute force attacks
3. **Use secure sessions** - HttpOnly, Secure flags
4. **Multi-factor authentication** - When possible

### Data Protection
1. **Encrypt data in transit** - HTTPS/TLS always
2. **Encrypt sensitive data at rest** - Database encryption
3. **Secure key management** - Key rotation, proper storage
4. **Data minimization** - Store only necessary data

### Configuration Security
1. **Environment-based secrets** - Never hardcode credentials
2. **Secure defaults** - Secure-by-default configuration
3. **Production safeguards** - Disable debug features
4. **Regular updates** - Keep dependencies current

This comprehensive security pattern reference provides guidance for both vulnerability detection and secure development practices.