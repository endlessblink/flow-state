# Pomo-Flow

A sophisticated Vue 3 productivity application that combines Pomodoro timer functionality with advanced task management across multiple views.

## 🎯 Features

### Core Functionality
- **Pomodoro Timer** with customizable work/break cycles
- **Task Management** with projects, priorities, and progress tracking
- **Multiple Views**: Board (Kanban), Calendar, Canvas, and All Tasks
- **Unified Undo/Redo System** for all operations
- **Real-time Persistence** with IndexedDB

### Advanced Features
- **Canvas Organization** - Free-form task arrangement with drag-and-drop
- **Smart Sections** - Auto-organize by priority, status, or project
- **Task Dependencies** - Visual connections between related tasks
- **Calendar Integration** - Schedule tasks with flexible time management
- **Dark/Light Theme** with glass morphism design system

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pomo-flow.git
cd pomo-flow

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5546
```

### Development Commands

```bash
npm run dev          # Start development server (port 5546)
npm run build        # Production build
npm run test         # Run tests
npm run storybook    # Component documentation (port 6006)
npm run kill         # Kill all processes (critical cleanup)
```

## 📱 Mobile App

Pomo-Flow is available as a native mobile app:

```bash
npm run build:mobile     # Build for mobile
npm run mobile:run:android  # Run on Android
npm run mobile:run:ios     # Run on iOS
```

## 🎨 Design System

Built with a custom design system featuring:
- **Glass Morphism** aesthetic with backdrop filters
- **Design Tokens** for consistent theming
- **Dark/Light Mode** support
- **Responsive Design** for all screen sizes

## 🏗️ Technology Stack

- **Vue 3** with Composition API and TypeScript
- **Pinia** for state management
- **Tailwind CSS** for styling
- **Vite** for development tooling
- **Vue Flow** for canvas interactions
- **IndexedDB** via LocalForage for persistence

## 📚 Documentation

### For Users
- [Feature Guide](docs/features/) - Detailed feature documentation
- [Getting Started](docs/getting-started/) - Beginner-friendly tutorials

### For Developers
- [Development Guide](CLAUDE.md) - Comprehensive development guidelines
- [API Documentation](docs/api/) - Technical reference
- [Component Library](http://localhost:6006) - Interactive component docs

### Architecture
- [System Architecture](.agent/system/) - Technical architecture documentation
- [Standard Operating Procedures](.agent/sop/) - Development workflows
- [Project Roadmap](plan.md) - Current development phases

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and conventions
- Development workflow
- Testing requirements
- Pull request process

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/pomo-flow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/pomo-flow/discussions)
- **Documentation**: Check the [Development Guide](CLAUDE.md) for troubleshooting

## 🗺️ Roadmap

See [plan.md](plan.md) for current development phases and upcoming features.

### Current Focus (Phase 2)
- Design System Phase 2 migration
- Enhanced mobile experience
- Advanced canvas features
- Performance optimizations

---

**Pomo-Flow** - Focus on what matters, one Pomodoro at a time.