# AI Prompt Optimizer (DSPy)

Fully automated prompt optimization for FlowState's 9 AI Task Assist actions.
Uses DSPy MIPROv2 to iteratively improve prompts without human intervention.

## Setup

No pip install needed — the script uses `uv` (already installed) to auto-fetch dependencies.

## Usage

```bash
cd tools/prompt-optimizer

# Set your API key (Groq is free and fast)
export GROQ_API_KEY="gsk_..."

# Optimize a specific action
./optimize.py --action improve_title

# Optimize all actions that have test cases
./optimize.py --action all

# Use a different provider
./optimize.py --action improve_title --provider ollama

# Control intensity (more calls = better results, more time/cost)
./optimize.py --action improve_title --intensity medium  # ~200 LLM calls
```

## How It Works

1. Loads golden test cases from `test_cases/` for the target action
2. Configures DSPy with your LLM provider (Groq by default)
3. Runs MIPROv2 optimizer: generates candidates, evaluates with LLM judge, iterates
4. Outputs the optimized prompt to `results/` and prints it to console
5. You paste the optimized prompt into `src/composables/useAITaskAssist.ts`

## Providers

| Provider | Task Model (cheap) | Judge Model (smart) | Cost |
|----------|-------------------|---------------------|------|
| `groq` (default) | Llama 3.1 8B | Llama 3.3 70B | Free |
| `ollama` | Llama 3.2 (local) | Llama 3.1 (local) | Free |
| `openrouter` | Llama 3.1 8B | Claude Sonnet | ~$2-5 per action |

## Adding Test Cases

Edit files in `test_cases/`. Each file is a JSON array of examples:

```json
[
  {
    "input": "fix the thing",
    "context": "E-commerce project",
    "expected": "Fix broken checkout redirect"
  }
]
```

You need ~20-50 examples per action for good optimization.

## Available Actions

| Action | Test Cases | Description |
|--------|-----------|-------------|
| `improve_title` | 25 | Fix vague/typo'd task titles |
| `suggest_priority` | TODO | Suggest priority + duration |
| `suggest_subtasks` | TODO | Generate 3-5 subtask ideas |
| `break_down` | TODO | Split task into 2-4 smaller ones |
| `suggest_date` | TODO | Recommend optimal scheduling date |
| `summarize_batch` | TODO | Summarize a group of tasks |
