# Activity Guide For Non-Developers

This guide is for team members who need to create or edit simulation activities but are not software developers.

## What Is An Activity?

An activity is one simulation task a trainee must complete.

Each activity includes:
- A title (what the task is called)
- A short instruction (what the trainee should do)
- A ladder diagram image
- A list of required devices
- A list of required wire connections

If all requirements are met, the system marks the activity as correct.

## Where Activities Are Stored

- Module 1 activities: `M1` folder
- Module 5 activities: `M5` folder

Path:
`client/src/simulation/constants/activityAnswers/`

## Simple Workflow (No Deep Coding Needed)

1. Open an existing activity in the same module (for example `activity-1.ts`).
2. Duplicate it and rename the copy to your new activity number (for example `activity-6.ts`).
3. Change only these parts first:
- `routeId`
- `title`
- `instruction`
- `diagram`
4. Update the required devices section.
5. Update the required connections section.
6. Register the new activity in `index.ts`.
7. Ask someone to run a quick check (`lint`/`build`) before release.

## Device Names You Can Use

Use these names in activity rules:
- `button`
- `buzzer`
- `counter`
- `lightIndicator`
- `magneticMotorContactor`
- `relayModule`
- `limitSwitch`
- `solenoidValve`
- `timer`

## Reading The Connection Rules In Plain English

You may see patterns like these:

- `[A, B]`
: means A must be connected to B.

- `[[A, B], [A, C]]`
: means either A-B OR A-C is acceptable.

- `connectToAny(A, VPLUS_PINS)`
: means A can connect to any 24V+ terminal.

- `...connectToAny(A, VPLUS_PINS)`
: this is used when combining "any 24V+" options with other options.

## Common Mistakes To Avoid

1. Do not use round brackets for connections.
- Wrong: `(A, B)`
- Correct: `[A, B]`

2. Do not type pin IDs manually.
- Use existing pin names from `RELAY_PIN_IDS`.

3. Do not forget to register your new activity in `index.ts`.

4. Keep `routeId` unique.
- Example format for Module 5: `5.1`, `5.2`, `5.3`, etc.

## Quick Quality Checklist

Before handing off your change, confirm:
- The title and instruction match the new task.
- The diagram image is correct.
- Required input/output devices are correct.
- Required components are correct.
- Minimum wire count looks reasonable.
- Connections reflect the intended ladder logic.
- The activity is added to `index.ts`.

## If You Are Unsure

If you are not sure about connection syntax or pin names:
- Copy a very similar existing activity and edit only what is necessary.
- Leave a short note in your pull request saying what you changed and what needs technical review.

This helps developers quickly validate and merge your activity safely.
