# Deprecated Technology Patterns Reference

## JavaScript / TypeScript Libraries

### Core Libraries (Deprecated)
- **request** - Deprecated due to security vulnerabilities and lack of maintenance
  - **Alternative**: `axios`, `node-fetch`, or native `fetch()`
  - **Risks**: Security vulnerabilities, performance issues
  - **Migration Impact**: High - used throughout codebase

- **moment.js** - Large bundle size, better alternatives available
  - **Alternative**: `date-fns`, `dayjs`, `luxon`
  - **Risks**: Performance impact, maintenance burden
  - **Migration Impact**: Medium - localized usage

- **underscore.js** - Native JavaScript alternatives available
  - **Alternative**: Lodash (if needed), native methods
  - **Risks**: Unnecessary dependency
  - **Migration Impact**: Low to Medium

- **bluebird** - Native promises widely supported
  - **Alternative**: Native Promise, async/await
  - **Risks**: Complexity, bundle size
  - **Migration Impact**: High if used extensively

### Build Tools (Deprecated)
- **Grunt** - Superseded by modern bundlers
  - **Alternative**: npm scripts, Vite, Rollup
  - **Risks**: Slow builds, complex configuration
  - **Migration Impact**: High - affects entire build process

- **Gulp** - Largely replaced by modern bundlers
  - **Alternative**: npm scripts, Vite, Webpack
  - **Risks**: Build performance, maintenance
  - **Migration Impact**: High

- **Bower** - Package manager replaced by npm/yarn
  - **Alternative**: npm, yarn, pnpm
  - **Risks**: Dependency conflicts
  - **Migration Impact**: Medium

### Testing Frameworks (Legacy)
- **Karma** - Largely replaced by modern testing frameworks
  - **Alternative**: Vitest, Jest, Playwright
  - **Risks**: Complex setup, slow tests
  - **Migration Impact**: Medium

- **Protractor** - Angular E2E testing, no longer maintained
  - **Alternative**: Playwright, Cypress
  - **Risks**: Compatibility issues
  - **Migration Impact**: High for E2E tests

## CSS Frameworks (Legacy)

### Legacy UI Libraries
- **Bootstrap 3** - Major version updates available
  - **Alternative**: Bootstrap 5, Tailwind CSS
  - **Risks**: Security issues, browser compatibility
  - **Migration Impact**: High - CSS changes

- **jQuery UI** - Replaced by modern component frameworks
  - **Alternative**: Vue.js, React, native web components
  - **Risks**: Performance, maintenance
  - **Migration Impact**: Very High

## Database Libraries (Deprecated)

### ORMs and Query Builders
- **Sequelize v4** - Major breaking changes in v5+
  - **Alternative**: Sequelize v6+, Prisma, TypeORM
  - **Risks**: Security, compatibility
  - **Migration Impact**: High

- **Mongoose v4** - Updated syntax in v5+
  - **Alternative**: Mongoose v6+, or modern alternatives
  - **Risks**: Breaking changes
  - **Migration Impact**: Medium

## Node.js Patterns (Legacy)

### Legacy Patterns
- **Callback hell** - Callback-based async patterns
  - **Alternative**: Promises, async/await
  - **Risks**: Readability, maintainability
  - **Migration Impact**: High

- **var declarations** - Replaced by let/const
  - **Alternative**: let, const
  - **Risks**: Scope issues
  - **Migration Impact**: Low

## Configuration Files (Legacy)

### Build Configuration
- **.travis.yml** - Travis CI largely deprecated
  - **Alternative**: GitHub Actions, GitLab CI
  - **Risks**: CI/CD reliability
  - **Migration Impact**: Medium

- **bower.json** - Bower package manager
  - **Alternative**: package.json
  - **Risks**: Dependency management
  - **Migration Impact**: Low to Medium

## Directory Patterns (Legacy)

### Common Legacy Directories
- **src/legacy/** - Explicitly marked legacy code
- **old/** - Deprecated implementations
- **v1/**, **v2/** - Versioned legacy code
- **bak/** - Backup directories
- **deprecated/** - Explicitly deprecated code
- **archive/** - Archived code

### Detection Patterns
```regex
# Directory patterns
^(src/)?legacy/
^old/
^v\d+/
^bak/
^deprecated/
^archive/

# File patterns
.*\.legacy\..*
.*\.old\..*
.*\.bak\..*
.*\.deprecated\..*

# Content markers
TODO.*remove
FIXME.*legacy
DEPRECATED
legacy.*code
temporar(y|ily)
```

## Migration Strategies

### Low Risk (Safe to Remove)
- Unused dependencies (zero references)
- Empty directories
- Backup files (.bak, .old)
- Commented out code blocks
- Duplicate utility functions

### Medium Risk (Review Required)
- Libraries with minimal usage (<3 references)
- Configuration files with unclear usage
- Test files for removed functionality
- Documentation for removed features

### High Risk (Migration Required)
- Core dependencies (React, Vue, etc.)
- Database connection libraries
- Authentication systems
- API endpoint definitions
- Production configuration files

## Risk Assessment Framework

### Risk Factors
1. **Usage Count** - How many files reference the item
2. **Criticality** - Is it core to application functionality
3. **Test Coverage** - Are there tests covering the functionality
4. **Dependencies** - What other items depend on it
5. **Team Knowledge** - Does the team understand how to replace it

### Risk Scoring
- **0.0-0.2**: Safe to remove immediately
- **0.2-0.6**: Requires review and testing
- **0.6-0.8**: High risk, migration required
- **0.8-1.0**: Very high risk, careful planning needed

## Best Practices

### Before Removal
1. **Full codebase search** for all references
2. **Dependency analysis** to understand impact
3. **Test coverage verification**
4. **Team consultation** for domain knowledge
5. **Backup creation** for rollback capability

### During Removal
1. **Batch processing** to minimize risk
2. **Automated testing** after each batch
3. **Git commits** with descriptive messages
4. **Rollback verification** procedures

### After Removal
1. **Documentation updates**
2. **Team communication**
3. **Performance monitoring**
4. **Bug tracking** for related issues

## Tool-Specific Patterns

### npm/yarn
```json
{
  "dependencies": {
    "request": "^2.88.2", // Deprecated
    "moment": "^2.29.4",   // Legacy
    "underscore": "^1.13.6" // Replaceable
  }
}
```

### Python requirements.txt
```txt
requests==2.25.1    // Old version, update available
Django==3.2.0       // Old major version
```

### Docker configurations
```dockerfile
FROM node:14-alpine  // Old Node.js version
```

## Modern Alternatives

### JavaScript/TypeScript
- **HTTP Requests**: fetch(), axios
- **Date Handling**: date-fns, dayjs, Intl.DateTimeFormat
- **Utilities**: Native methods, modern frameworks
- **Async**: async/await, Promise
- **Build**: Vite, Rollup, esbuild

### CSS
- **Frameworks**: Tailwind CSS, utility-first approaches
- **Components**: Web components, modern framework components

### Testing
- **Unit**: Vitest, Jest
- **E2E**: Playwright, Cypress
- **Integration**: Modern testing patterns

### CI/CD
- **Platforms**: GitHub Actions, GitLab CI
- **Containers**: Modern Docker practices