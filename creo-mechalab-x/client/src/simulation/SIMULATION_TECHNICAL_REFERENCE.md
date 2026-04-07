# Simulation Technical Reference

This file documents technical details for wiring, evaluation, scoring, persistence, and progression.
Use this as the source for implementation behavior and QA validation.

## Wire System Documentation

### How to add wires

- Click and drag from one terminal pin to another terminal pin.
- Release on the target pin to create the wire.
- Simple click without drag does not create a connection.
- Duplicate connections are blocked.
- A pin has a max capacity of 2 wire endpoints.

### Wire routing behavior

- Wires are auto-routed as orthogonal paths (90-degree segments).
- The router prefers paths with:
  - less overlap with existing wires,
  - shorter total length,
  - fewer turns.
- If overlap is unavoidable, the system chooses the lowest-penalty candidate path.

### Wire colors

- Wire colors are visual aids for the trainee.
- Available colors in UI:
  - `24V Red`
  - `0V Black`
  - `Signal Blue`
  - `Signal Yellow`
  - `Earth Green`
- Color does not change validation result by itself.

### Wire editing tools

- Select a wire, then press `Delete`/`Backspace` or click delete.
- `Undo` and `Redo` are available.
- `Clear Board` removes all wires and resets runtime states.

## Evaluation And Scoring Documentation

### Scoring model (current implementation)

- Current score is binary:
  - `100%` when answer passes
  - `0%` when answer fails
- There is no partial score in the current checker.

### What is evaluated

When `Check Answer` is clicked, the evaluator checks:

- Input device requirements (`requiredInputDevices`)
- Output/control device requirements (`requiredOutputDevices`)
- Required component counts (`requiredComponents`)
- Minimum number of wires (`minWires`)
- Required custom connection paths (`customConnections`), including OR options

### Connection validation rules

- Pin aliases are resolved (example: top-strip relay aliases).
- Required connections are treated as undirected pairs (`A <-> B` equals `B <-> A`).
- OR groups are supported (one of the listed paths is acceptable).
- Some answers require distinct wires across required paths.
- Unknown pin IDs in answer definitions are reported as configuration issues.

### Wrong wire detection

- Wrong wires are highlighted after checking.
- Wrong-wire messages are generated when a wire does not match accepted answer paths.
- UI may show simplified feedback states:
  - no devices,
  - missing wires,
  - wrong wires.

### Runtime preview vs check-answer result

- `activityEvaluationPreview` is continuously computed and used to gate runtime outputs.
- `Check Answer` stores a snapshot result (`answerFeedback`) for visible pass/fail feedback and progression.
- In practice, outputs (lamps/timer behavior) only become active when preview validation is currently passing.

## Progress, Completion, And Persistence

### Local save behavior

- Simulation states are saved in local storage under `creosim_simulation_states`.
- Saved activity data includes:
  - wire list,
  - assigned input/output devices.
- Activity key format supports module scoping (example: `M5:3`).

### Completion logic

- An activity is considered completed after a successful check-answer save.
- Completed activities show as cleared in the node HUD.
- `Next Activity` becomes available when current activity is completed or passed.

### Session behavior

- If a stored solved state exists, the activity can show as already completed.
- Runtime interactions (wiring/device edits) can be limited in completed sessions.

## Developer Reference (Source Of Truth)

- Evaluator: `src/simulation/utils/evaluateActivityAnswer.ts`
- Wire router: `src/simulation/utils/wireRouting.ts`
- Runtime + UI logic: `src/simulation/SimulationApp.tsx`
- Activity answer schema: `src/simulation/constants/activityAnswers/types.ts`
- Activity definitions: `src/simulation/constants/activityAnswers/`
