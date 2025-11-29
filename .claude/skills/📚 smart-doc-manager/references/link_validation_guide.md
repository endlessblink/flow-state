# Link Validation Guide

Comprehensive strategies for checking and maintaining link integrity in documentation.

## Types of Links

### Internal Links
- **Relative links**: `[Text](../path/file.md)` - Links within the documentation
- **Anchor links**: `[Text](#section-name)` - Links to sections within the same document
- **Cross-references**: `[Text](./other-file.md#section)` - Links to specific sections

### External Links
- **HTTP/HTTPS links**: `[Text](https://example.com)` - Links to external websites
- **File links**: `[Text](file:///path/to/file)` - Links to local files
- **Email links**: `[Text](mailto:user@example.com)` - Links to email addresses

## Validation Tools

### Command Line Tools

#### markdown-link-check
```bash
# Install
npm install -g markdown-link-check

# Check single file
markdown-link-check file.md

# Check multiple files
find . -name "*.md" -exec markdown-link-check {} \;

# Custom configuration
markdown-link-check file.md --config .linkcheck.json
```

#### lychee (Rust-based)
```bash
# Install
cargo install lychee

# Check all markdown files
lychee docs/**/*.md

# Check with specific configuration
lychee --verbose --no-progress docs/**/*.md
```

### Python-based Solutions

#### Using requests library
```python
import requests
import re
from pathlib import Path

def check_external_links(file_path):
    """Check external links in a markdown file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract external links
    external_links = re.findall(r'\[.*?\]\((https?://.*?)\)', content)

    broken_links = []
    for link in external_links:
        try:
            response = requests.head(link, timeout=10, allow_redirects=True)
            if response.status_code >= 400:
                broken_links.append((link, response.status_code))
        except requests.RequestException as e:
            broken_links.append((link, str(e)))

    return broken_links
```

## Link Validation Patterns

### Internal Link Validation

#### Relative Link Resolution
```bash
# Find all relative links
rg '\[.*\]\(([^h].*\.md)\)' docs/ --only-matching

# Check if target files exist
for link in $(rg -o '\[.*\]\(([^h].*\.md)\)' docs/ | sort -u); do
    target="docs/${link#*/}"  # Remove first part if it's a directory
    if [ ! -f "$target" ]; then
        echo "BROKEN: $link -> $target"
    fi
done
```

#### Anchor Link Validation
```python
def validate_anchor_links(file_path):
    """Validate anchor links within markdown files"""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Extract all headers
    headers = {}
    for i, line in enumerate(lines, 1):
        if line.startswith('#'):
            # Convert header to anchor ID
            header_text = line.lstrip('#').strip()
            anchor = header_text.lower()
            anchor = re.sub(r'[^\w\s-]', '', anchor)
            anchor = re.sub(r'[-\s]+', '-', anchor)
            headers[anchor] = i

    # Check anchor links
    anchor_links = re.findall(r'\[.*?\]\(#([^)]+)\)', '\n'.join(lines))
    broken_anchors = []

    for anchor in anchor_links:
        if anchor not in headers:
            broken_anchors.append(anchor)

    return broken_anchors, headers
```

### External Link Validation

#### HTTP Status Code Handling
```python
def check_link_with_retry(url, max_retries=3):
    """Check external link with retry logic"""
    for attempt in range(max_retries):
        try:
            response = requests.head(
                url,
                timeout=10,
                allow_redirects=True,
                headers={'User-Agent': 'Documentation Link Checker'}
            )

            # Handle different status codes
            if response.status_code == 200:
                return True, "OK"
            elif response.status_code == 429:
                # Rate limited - wait and retry
                time.sleep(2 ** attempt)
                continue
            elif response.status_code >= 500:
                # Server error - might be temporary
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return False, f"Server error: {response.status_code}"
            else:
                # Client error (4xx) - likely permanent
                return False, f"Client error: {response.status_code}"

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return False, "Timeout"
        except requests.exceptions.RequestException as e:
            return False, str(e)

    return False, "Max retries exceeded"
```

## Link Maintenance Strategies

### Dependency Graph Building
```python
def build_link_dependency_graph(docs_dir):
    """Build a graph of document dependencies"""
    graph = {}

    for file_path in Path(docs_dir).rglob("*.md"):
        relative_path = str(file_path.relative_to(docs_dir))
        graph[relative_path] = []

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract internal links
        internal_links = re.findall(r'\[.*?\]\(([^h][^)]*\.md)\)', content)

        for link in internal_links:
            # Resolve relative path
            if link.startswith('./'):
                target = str(Path(relative_path).parent / link[2:])
            elif link.startswith('../'):
                target = str(Path(relative_path).parent.parent / link[3:])
            else:
                target = link

            graph[relative_path].append(target)

    return graph
```

### Safe File Deletion Check
```python
def can_safely_delete(file_path, dependency_graph):
    """Check if a file can be safely deleted"""
    relative_path = str(file_path.relative_to(docs_dir))

    # Check if any other files link to this one
    for source_file, targets in dependency_graph.items():
        if relative_path in targets and source_file != relative_path:
            return False, f"Referenced by: {source_file}"

    return True, "Safe to delete"
```

## Best Practices

### Link Organization
1. **Use relative paths** for internal links
2. **Include file extensions** (.md) for clarity
3. **Use descriptive anchor text** - avoid "click here"
4. **Group related links** in navigation sections

### Link Maintenance
1. **Automate link checking** in CI/CD pipelines
2. **Set up monitoring** for external link health
3. **Use link shorteners** sparingly (they can break)
4. **Archive outdated content** instead of breaking links

### Link Quality
1. **Prefer official documentation** over third-party tutorials
2. **Use stable URLs** (avoid temporary links)
3. **Include link context** in the surrounding text
4. **Test links after major refactors**

## Configuration Examples

### markdown-link-check Configuration
```json
{
  "ignorePatterns": [
    {
      "pattern": "http://localhost"
    },
    {
      "pattern": "https://example.com/internal"
    }
  ],
  "replacementPatterns": [
    {
      "pattern": "^/docs/",
      "replacement": "https://example.com/docs/"
    }
  ],
  "httpHeaders": [
    {
      "urls": ["https://api.github.com"],
      "headers": {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Documentation Link Checker"
      }
    }
  ],
  "timeout": "20s",
  "retryOn429": true,
  "retryCount": 3,
  "fallbackRetryDelay": "30s"
}
```

### GitHub Actions Workflow
```yaml
name: Link Check

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  link-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'

    - name: Install markdown-link-check
      run: npm install -g markdown-link-check

    - name: Check links
      run: |
        find docs -name "*.md" -print0 | xargs -0 -n1 markdown-link-check