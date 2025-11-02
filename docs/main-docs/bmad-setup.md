# BMad Framework Setup for pomo-flow

## Overview
The BMad (Business Model and Development) framework has been configured for the pomo-flow project to provide structured AI-assisted development workflows.

## Configuration Files Created

### Core Configuration
- `.bmad-core/core-config.yaml` - Main configuration mapping project structure
- `.bmad-core/agent-teams/team-fullstack.yaml` - Team definition with available agents
- `.bmad-core/agents/bmad-orchestrator.md` - Master orchestrator agent
- `.bmad-core/workflows/brownfield-fullstack.yaml` - Workflow for enhancing existing projects
- `.bmad-core/tasks/document-project.md` - Task for project analysis

## Available Agents

1. **BMad Orchestrator** (`bmad-orchestrator`)
   - Master coordinator for all agents
   - Use: `*agent bmad-orchestrator`
   - Commands: `*help`, `*workflow`, `*status`

2. **Business Analyst** (`analyst`)
   - Project analysis and requirements gathering
   - Use: `*agent analyst`

3. **Product Manager** (`pm`)
   - PRD creation and product planning
   - Use: `*agent pm`

4. **Architect** (`architect`)
   - Technical architecture and system design
   - Use: `*agent architect`

5. **Product Owner** (`po`)
   - Validation and quality assurance
   - Use: `*agent po`

## Available Workflows

1. **Brownfield Fullstack** (`brownfield-fullstack`)
   - For enhancing existing applications
   - Steps: Analysis → PRD → Architecture → Validation
   - Use: `*workflow brownfield-fullstack`

## Usage Examples

### Start with the Orchestrator
```
*agent bmad-orchestrator
*help
```

### Run Project Analysis
```
*agent analyst
*task document-project
```

### Follow Enhancement Workflow
```
*workflow brownfield-fullstack
```

## Integration with Existing MCP Servers

The BMad framework works alongside your existing MCP servers:
- `devtools-debugger` - For debugging assistance
- `octocode` - For GitHub code search
- BMad agents can coordinate with these tools for comprehensive development support

## Next Steps

1. Start with the orchestrator to get oriented: `*agent bmad-orchestrator`
2. Run project analysis to understand current state: `*agent analyst` → `*task document-project`
3. Follow the brownfield workflow to plan enhancements
4. Use existing MCP tools during implementation

The BMad framework provides structured workflows while your existing MCP servers provide specialized tools - they complement each other perfectly for productivity app development.