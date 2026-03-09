#!/usr/bin/env -S uv run --with dspy python3
"""
FlowState AI Prompt Optimizer
Uses DSPy MIPROv2 to automatically optimize prompts for all 9 AI Task Assist actions.

Usage:
    python optimize.py --action improve_title
    python optimize.py --action improve_title --provider ollama
    python optimize.py --action all
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import dspy
    from dspy import MIPROv2
except ImportError:
    print("ERROR: dspy not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# ============================================================================
# Provider Configuration
# ============================================================================

def get_provider(provider_name: str, role: str = "task") -> dspy.LM:
    """
    Get a configured LLM provider.
    role: "task" (the model being optimized) or "judge" (evaluator model)
    """
    if provider_name == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            print("ERROR: Set GROQ_API_KEY environment variable")
            sys.exit(1)
        if role == "judge":
            # Use stronger model for judging
            return dspy.LM("groq/llama-3.3-70b-versatile", api_key=api_key, temperature=0.1)
        else:
            # Optimize for the model users actually get
            return dspy.LM("groq/llama-3.1-8b-instant", api_key=api_key, temperature=0.7)

    elif provider_name == "ollama":
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        if role == "judge":
            return dspy.LM("ollama_chat/llama3.1", api_base=base_url, api_key="", temperature=0.1)
        else:
            return dspy.LM("ollama_chat/llama3.2", api_base=base_url, api_key="", temperature=0.7)

    elif provider_name == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            print("ERROR: Set OPENROUTER_API_KEY environment variable")
            sys.exit(1)
        if role == "judge":
            return dspy.LM(
                "openrouter/anthropic/claude-sonnet-4-20250514",
                api_base="https://openrouter.ai/api/v1",
                api_key=api_key,
                temperature=0.1,
            )
        else:
            return dspy.LM(
                "openrouter/meta-llama/llama-3.1-8b-instruct",
                api_base="https://openrouter.ai/api/v1",
                api_key=api_key,
                temperature=0.7,
            )
    else:
        print(f"ERROR: Unknown provider '{provider_name}'. Use: groq, ollama, openrouter")
        sys.exit(1)


# ============================================================================
# Action Definitions (Signatures + Metrics)
# ============================================================================

class ImproveTitle(dspy.Signature):
    """Rewrite a vague or poorly-written task title to be specific, actionable, and concise.
    Fix typos and grammar. Preserve the original language (Hebrew stays Hebrew, English stays English, mixed stays mixed).
    Start with a verb when possible. Keep under 60 characters.
    If the title is already clear, return it as-is with only typo fixes.
    If too vague to improve (1-2 generic words with no context), return unchanged."""

    original_title: str = dspy.InputField(desc="The user's original task title, may contain typos, mixed languages (Hebrew+English), or be vague")
    project_context: str = dspy.InputField(desc="Brief context about the project this task belongs to")
    improved_title: str = dspy.OutputField(desc="The improved task title — concise, verb-first, typos fixed, same language as input")


class SuggestPriority(dspy.Signature):
    """Analyze a task and suggest its priority level and estimated time duration.
    Consider task complexity, urgency indicators in the title, and project context."""

    task_title: str = dspy.InputField(desc="The task title")
    task_description: str = dspy.InputField(desc="Optional task description, may be empty")
    current_priority: str = dspy.InputField(desc="Current priority if set: low/medium/high, or 'none'")
    current_duration: str = dspy.InputField(desc="Current estimated duration in minutes, or 'none'")
    priority: str = dspy.OutputField(desc="Suggested priority: 'low', 'medium', or 'high'")
    duration: int = dspy.OutputField(desc="Estimated duration in minutes: 15, 30, 60, 90, or 120")
    reasoning: str = dspy.OutputField(desc="One sentence explaining the suggestion")


class SuggestSubtasks(dspy.Signature):
    """Given a task title and optional description, suggest 3-5 actionable subtasks.
    Each subtask should be a concrete, completable action (not vague).
    Preserve the language of the original task."""

    task_title: str = dspy.InputField(desc="The main task title")
    task_description: str = dspy.InputField(desc="Optional task description, may be empty")
    subtasks: list[str] = dspy.OutputField(desc="List of 3-5 actionable subtask titles")


class BreakDownTask(dspy.Signature):
    """Break a large task into 2-4 smaller, independent tasks.
    Each sub-task should be completable on its own and have a clear priority."""

    task_title: str = dspy.InputField(desc="The task to break down")
    task_description: str = dspy.InputField(desc="Optional description, may be empty")
    tasks: list[dict] = dspy.OutputField(desc="List of 2-4 dicts with 'title' and 'priority' (low/medium/high) keys")


class SuggestDate(dspy.Signature):
    """Suggest the optimal date to work on this task.
    Consider task urgency, current date, and whether it's a quick task (do today) or needs planning (schedule ahead).
    Never suggest past dates."""

    task_title: str = dspy.InputField(desc="The task title")
    task_description: str = dspy.InputField(desc="Optional description")
    today: str = dspy.InputField(desc="Today's date in YYYY-MM-DD format")
    current_due_date: str = dspy.InputField(desc="Current due date if set, or 'none'")
    date: str = dspy.OutputField(desc="Suggested date in YYYY-MM-DD format")
    reasoning: str = dspy.OutputField(desc="One sentence explaining why this date")


class SummarizeBatch(dspy.Signature):
    """Summarize what a group of tasks have in common and suggest a group name.
    The group name should be short (2-4 words) and descriptive."""

    task_titles: str = dspy.InputField(desc="Numbered list of task titles")
    summary: str = dspy.OutputField(desc="Brief summary of what these tasks share")
    suggested_group: str = dspy.OutputField(desc="Short group name (2-4 words)")


# Map action names to their signatures
ACTION_SIGNATURES = {
    "improve_title": ImproveTitle,
    "suggest_priority": SuggestPriority,
    "suggest_subtasks": SuggestSubtasks,
    "break_down": BreakDownTask,
    "suggest_date": SuggestDate,
    "summarize_batch": SummarizeBatch,
}

# ============================================================================
# Metrics (LLM-as-Judge)
# ============================================================================

def make_judge_metric(action_name: str, judge_lm: dspy.LM):
    """Create an LLM-as-judge metric for a specific action."""

    class JudgeSignature(dspy.Signature):
        """Rate the quality of an AI assistant's output on a scale of 0.0 to 1.0."""
        criteria: str = dspy.InputField()
        original_input: str = dspy.InputField()
        expected_output: str = dspy.InputField()
        actual_output: str = dspy.InputField()
        score: float = dspy.OutputField(desc="Quality score from 0.0 (terrible) to 1.0 (perfect)")

    judge = dspy.Predict(JudgeSignature)

    criteria_map = {
        "improve_title": """Rate this improved task title 0.0-1.0:
- Language preserved? (Hebrew stays Hebrew, English stays English, mixed stays mixed) — 0 if language changed
- Typos fixed? — deduct 0.2 if original typos remain
- Meaning preserved? (no information lost) — 0 if meaning changed significantly
- Concise? (under 60 chars, starts with verb) — deduct 0.1 if too long
- If original was already clear, was it returned mostly unchanged? — 0.3 deduction if unnecessarily rewritten
- If original was too vague (1-2 words), was it returned unchanged? — 0.2 deduction if hallucinated specifics""",

        "suggest_priority": """Rate this priority+duration suggestion 0.0-1.0:
- Priority reasonable for the task? (high=urgent/complex, medium=normal, low=quick/trivial)
- Duration realistic? (not absurdly short or long for the task type)
- Reasoning makes sense and is specific to THIS task (not generic)?""",

        "suggest_subtasks": """Rate these subtask suggestions 0.0-1.0:
- Are there 3-5 subtasks? (deduct 0.3 if wrong count)
- Each subtask is a concrete action (not vague like "plan" or "research")?
- Subtasks cover the main task's scope without overlap?
- Language matches the original task?""",

        "break_down": """Rate this task breakdown 0.0-1.0:
- Are there 2-4 sub-tasks? (deduct 0.3 if wrong count)
- Each sub-task is independently completable?
- Priorities are reasonable?
- Together they cover the original task?""",

        "suggest_date": """Rate this date suggestion 0.0-1.0:
- Date is not in the past?
- Date is reasonable for the task type (urgent=today/tomorrow, complex=few days ahead)?
- Reasoning is specific and makes sense?""",

        "summarize_batch": """Rate this batch summary 0.0-1.0:
- Summary accurately captures what the tasks share?
- Group name is short (2-4 words) and descriptive?
- Language matches the tasks?""",
    }

    criteria = criteria_map.get(action_name, "Rate the output quality 0.0-1.0 based on accuracy, relevance, and language preservation.")

    def metric(example, prediction, trace=None):
        try:
            with dspy.context(lm=judge_lm):
                result = judge(
                    criteria=criteria,
                    original_input=getattr(example, 'original_title', '') or getattr(example, 'task_title', '') or str(getattr(example, 'input', '')),
                    expected_output=str(getattr(example, 'expected', '')),
                    actual_output=str(getattr(prediction, 'improved_title', '')) or str(prediction),
                )
            score = float(result.score)
            return max(0.0, min(1.0, score))
        except Exception as e:
            print(f"  Judge error: {e}")
            return 0.0

    return metric


# ============================================================================
# Test Case Loading
# ============================================================================

def load_test_cases(action_name: str) -> list[dspy.Example]:
    """Load test cases from JSON file and convert to DSPy Examples."""
    test_file = Path(__file__).parent / "test_cases" / f"{action_name}.json"
    if not test_file.exists():
        print(f"ERROR: No test cases found at {test_file}")
        print(f"Create {test_file} with 20+ examples. See README.md for format.")
        sys.exit(1)

    with open(test_file) as f:
        cases = json.load(f)

    if len(cases) < 10:
        print(f"WARNING: Only {len(cases)} test cases. 20+ recommended for good optimization.")

    examples = []
    for case in cases:
        if action_name == "improve_title":
            ex = dspy.Example(
                original_title=case["input"],
                project_context=case.get("context", ""),
                improved_title=case["expected"],
            ).with_inputs("original_title", "project_context")
        elif action_name == "suggest_priority":
            ex = dspy.Example(
                task_title=case["input"],
                task_description=case.get("description", ""),
                current_priority=case.get("current_priority", "none"),
                current_duration=case.get("current_duration", "none"),
                priority=case["expected_priority"],
                duration=case["expected_duration"],
                reasoning=case.get("expected_reasoning", ""),
            ).with_inputs("task_title", "task_description", "current_priority", "current_duration")
        elif action_name == "suggest_subtasks":
            ex = dspy.Example(
                task_title=case["input"],
                task_description=case.get("description", ""),
                subtasks=case["expected"],
            ).with_inputs("task_title", "task_description")
        elif action_name == "suggest_date":
            ex = dspy.Example(
                task_title=case["input"],
                task_description=case.get("description", ""),
                today=case.get("today", datetime.now().strftime("%Y-%m-%d")),
                current_due_date=case.get("current_due_date", "none"),
                date=case["expected_date"],
                reasoning=case.get("expected_reasoning", ""),
            ).with_inputs("task_title", "task_description", "today", "current_due_date")
        else:
            # Generic fallback
            ex = dspy.Example(
                input=case.get("input", ""),
                expected=case.get("expected", ""),
            ).with_inputs("input")
        examples.append(ex)

    return examples


# ============================================================================
# Main Optimizer
# ============================================================================

def optimize_action(action_name: str, provider: str, intensity: str = "light"):
    """Run DSPy MIPROv2 optimization for a specific action."""

    print(f"\n{'='*60}")
    print(f"  Optimizing: {action_name}")
    print(f"  Provider: {provider} | Intensity: {intensity}")
    print(f"{'='*60}\n")

    if action_name not in ACTION_SIGNATURES:
        print(f"ERROR: Unknown action '{action_name}'")
        print(f"Available: {', '.join(ACTION_SIGNATURES.keys())}")
        sys.exit(1)

    # Load test cases
    examples = load_test_cases(action_name)
    print(f"Loaded {len(examples)} test cases")

    # Split: 70% train, 30% validation
    split = int(len(examples) * 0.7)
    trainset = examples[:split]
    valset = examples[split:]
    print(f"Train: {len(trainset)}, Validation: {len(valset)}")

    # Configure models
    task_lm = get_provider(provider, role="task")
    judge_lm = get_provider(provider, role="judge")
    dspy.configure(lm=task_lm)

    # Create program
    signature = ACTION_SIGNATURES[action_name]
    program = dspy.Predict(signature)

    # Create metric
    metric = make_judge_metric(action_name, judge_lm)

    # Run baseline evaluation first
    print("\nRunning baseline evaluation...")
    baseline_scores = []
    for ex in valset[:5]:
        try:
            pred = program(**{k: getattr(ex, k) for k in ex.inputs()})
            score = metric(ex, pred)
            baseline_scores.append(score)
            print(f"  Score: {score:.2f}")
        except Exception as e:
            print(f"  Error: {e}")
            baseline_scores.append(0.0)
    baseline_avg = sum(baseline_scores) / len(baseline_scores) if baseline_scores else 0
    print(f"\nBaseline average score: {baseline_avg:.2f}")

    # Run optimization
    print(f"\nStarting MIPROv2 optimization (auto={intensity})...")
    print("This may take 5-30 minutes depending on intensity and provider speed.\n")

    optimizer = MIPROv2(
        metric=metric,
        auto=intensity,
        num_threads=4,
    )

    optimized_program = optimizer.compile(
        program,
        trainset=trainset,
        max_labeled_demos=4,
        max_bootstrapped_demos=2,
        requires_permission_to_run=False,
    )

    # Evaluate optimized version
    print("\nRunning optimized evaluation...")
    opt_scores = []
    for ex in valset[:5]:
        try:
            pred = optimized_program(**{k: getattr(ex, k) for k in ex.inputs()})
            score = metric(ex, pred)
            opt_scores.append(score)
            print(f"  Score: {score:.2f}")
        except Exception as e:
            print(f"  Error: {e}")
            opt_scores.append(0.0)
    opt_avg = sum(opt_scores) / len(opt_scores) if opt_scores else 0

    print(f"\n{'='*60}")
    print(f"  RESULTS: {action_name}")
    print(f"  Baseline:  {baseline_avg:.2f}")
    print(f"  Optimized: {opt_avg:.2f}")
    print(f"  Improvement: {'+' if opt_avg > baseline_avg else ''}{(opt_avg - baseline_avg):.2f}")
    print(f"{'='*60}")

    # Save results
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)

    # Save the optimized program
    program_path = results_dir / f"{action_name}_optimized.json"
    optimized_program.save(str(program_path))
    print(f"\nSaved optimized program to: {program_path}")

    # Extract and save the prompt
    try:
        # DSPy stores the optimized instruction in the signature
        instructions = optimized_program.predict.signature.instructions
        prompt_path = results_dir / f"{action_name}_prompt.txt"
        with open(prompt_path, "w") as f:
            f.write(instructions)
        print(f"Saved optimized prompt to: {prompt_path}")
        print(f"\n--- OPTIMIZED PROMPT ---\n{instructions}\n--- END ---")
    except Exception as e:
        print(f"Could not extract prompt text: {e}")
        print("Check the saved JSON file for the full optimized program.")

    # Save few-shot demos if any
    try:
        demos = optimized_program.predict.demos
        if demos:
            demos_path = results_dir / f"{action_name}_demos.json"
            with open(demos_path, "w") as f:
                json.dump([d.toDict() for d in demos], f, indent=2, ensure_ascii=False)
            print(f"Saved {len(demos)} few-shot demos to: {demos_path}")
    except Exception:
        pass

    return opt_avg


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="FlowState AI Prompt Optimizer")
    parser.add_argument(
        "--action",
        required=True,
        help="Action to optimize: improve_title, suggest_priority, suggest_subtasks, break_down, suggest_date, summarize_batch, or 'all'",
    )
    parser.add_argument(
        "--provider",
        default="groq",
        choices=["groq", "ollama", "openrouter"],
        help="LLM provider (default: groq)",
    )
    parser.add_argument(
        "--intensity",
        default="light",
        choices=["light", "medium", "heavy"],
        help="Optimization intensity: light (~50 calls), medium (~200 calls), heavy (~500 calls)",
    )
    args = parser.parse_args()

    if args.action == "all":
        results = {}
        for action in ACTION_SIGNATURES:
            test_file = Path(__file__).parent / "test_cases" / f"{action}.json"
            if test_file.exists():
                results[action] = optimize_action(action, args.provider, args.intensity)
            else:
                print(f"\nSkipping {action} — no test cases found at {test_file}")

        print(f"\n{'='*60}")
        print("  FINAL RESULTS")
        print(f"{'='*60}")
        for action, score in results.items():
            print(f"  {action}: {score:.2f}")
    else:
        optimize_action(args.action, args.provider, args.intensity)


if __name__ == "__main__":
    main()
