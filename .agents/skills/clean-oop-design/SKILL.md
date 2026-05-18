---
name: clean-oop-design
description: Enforces clean Object-Oriented Programming (OOP) principles when writing or refactoring TypeScript code, ensuring high readability, testability, and maintainability. Trigger when writing new classes or modifying existing methods.
---

# Clean OOP Design Principles

When writing or refactoring Object-Oriented code in this workspace, you MUST adhere to the following principles to maintain readability and clarity:

## 1. Single Responsibility Principle (SRP)
- Classes and methods should have one primary reason to change.
- A method should do exactly one thing. If a method exceeds ~20-30 lines, consider breaking it down.
- Avoid large monolithic methods (like "God functions" or massive `exec()` loops).

## 2. Extract Methods for Clarity
- If a block of code within a method can be conceptually grouped (e.g., executing a specific list mode vs test mode, or collecting configuration), **extract it into a dedicated `protected` or `private` helper method**.
- Name the extracted method descriptively so that it acts as its own documentation.

## 3. Encapsulation & Access Modifiers
- Use `private` (or `#` in modern JS/TS) for internal state and helpers that should not be exposed.
- Use `protected` for methods that subclasses might need to override or access.
- Only expose `public` methods that form the core API contract of the class.

## 4. Push Logic to Data Owners
- Instead of an external manager reaching into an object's internal state to serialize or filter it, push that logic into the object itself (e.g., adding a `toJSON()` method to the data-holding class instead of mapping it externally).

## 5. Favor Getters for Derived State
- Instead of evaluating complex boolean checks inline (e.g., `typeof window !== 'undefined' && !!window.__lupa__?.config?.list`), extract them into explicit getters (e.g., `get isList(): boolean`) to improve legibility.
