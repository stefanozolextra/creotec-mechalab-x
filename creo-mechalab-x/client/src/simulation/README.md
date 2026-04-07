# Simulation Behavior Guide

This document explains how the simulation behaves at runtime in simple terms.
Use it when you want to understand what makes lamps, buttons, timers, and solenoids turn on or off.

## Basic Rule

Most visible outputs only work when all of these are true:

- The main switch is ON
- The wiring and device setup is correct
- The current activity logic allows that component to turn on

If the wiring is wrong, the component may stay off even if the button is pressed.

## Button Mapping

The manual buttons in the simulation use this naming:

- `PB1` = `START-1`
- `PB2` = `START-2`
- `PB3` = `STOP-1`
- `PB4` = `STOP-2`
- `Emergency Stop` = `emergency-stop`

## Lamp Activation Logic

### Activity 1

- Press `START-1` to turn the green lamp on.
- Press `STOP-1` or `Emergency Stop` to turn the green lamp off.
- The green lamp stays on after START until STOP is pressed.

### Activity 2

- Press `START-1` to turn the green lamp on.
- Press `STOP-1` or `Emergency Stop` to turn the red lamp on.
- The red lamp is used as the stop signal.

### Activity 3

- Press `START-1` to turn the green lamp on.
- Press `START-2` to turn the yellow lamp on.
- Press `STOP-1`, `STOP-2`, or `Emergency Stop` to turn both lamps off.

### Activity 4

- Press `START-1` or `START-2` to turn the green lamp on.
- Press `STOP-1` or `Emergency Stop` to turn the yellow lamp on.

### Activity 5

- Press `START-1` to start the timer.
- While the timer is running, the yellow lamp stays on.
- When the timer finishes, the green lamp turns on.
- Press `STOP-1` or `Emergency Stop` to reset the timer and return to the idle state.

## Solenoid Activation Logic

The M5 activities use solenoid labels that describe movement direction.

### A Cylinder

- `aPlusPositive` = A+ extend
- `aPlusNegative` = A+ retract
- `aMinusPositive` = A- extend
- `aMinusNegative` = A- retract

### B Cylinder

- `bPlusPositive` = B+ extend
- `bPlusNegative` = B+ retract
- `bMinusPositive` = B- extend
- `bMinusNegative` = B- retract

## What The Simulation Shows

The simulation updates the component states from the current activity and wiring:

- Lamps change based on the current button action and timer state
- The timer changes from idle to timing, then to done
- Solenoid sections are shown using the extend/retract naming above
- The wiring must match the activity answer before the runtime behavior becomes active

## Practical Examples

- If the wiring is correct in Activity 1, pressing `START-1` should light the green lamp.
- If the wiring is correct in Activity 2, pressing `STOP-1` should light the red lamp.
- If the wiring is correct in Activity 5, the green lamp comes on only after the delay finishes.

## Related Docs

- [Activity answer guide](constants/activityAnswers/README.md)
- [Non-developer activity guide](constants/activityAnswers/ACTIVITY_GUIDE_FOR_NON_DEVELOPERS.md)
- [M1 comment guide](constants/activityAnswers/M1/COMMENT_DOCUMENTATION.md)
- [M5 comment guide](constants/activityAnswers/M5/COMMENT_DOCUMENTATION.md)
