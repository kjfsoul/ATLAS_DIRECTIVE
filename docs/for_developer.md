# Onboarding Guide for New Developers: The ATLAS Directive

## 1. Project Overview

Welcome to **The ATLAS Directive**, an educational narrative choice game built with Next.js 14+ and TypeScript. The game revolves around the interstellar object 3I/ATLAS, allowing players to make decisions that determine its fate.

The core of the game is a **multi-chunk narrative architecture**. The story is not stored in a single monolithic file but is broken down into smaller, manageable JSON files located in the `/data` directory. This design was adopted to resolve data integrity issues and facilitate parallel development between multiple AI agents.

## 2. Technical Architecture

*   **Framework**: Next.js 14+ with TypeScript
*   **UI**: React
*   **Styling**: CSS Modules (`AtlasDirective.module.css`)
*   **Data Management**: Narrative content is stored in multiple JSON files in the `/data` directory. Each file represents a "chunk" or branch of the story.
*   **State Management**: Managed within React components.

## 3. Key Scripts & Validation

The project includes several important scripts in the `package.json` file:

*   `npm run dev`: Starts the Next.js development server.
*   `npm run build`: Builds the application for production.
*   `npm run lint`: Runs ESLint to check for code quality issues.
*   `npm run narrative:validate:multi`: This is a crucial script that validates all narrative chunks in the `/data` directory. It checks for schema compliance, duplicate node IDs, and unreachable nodes. **Always run this script after making changes to the narrative files.**

The project also has a **narrative edit lock system** to prevent concurrent editing conflicts. Before editing any narrative files, you must acquire a lock using `npm run lock:acquire`. Once you're done, release the lock with `npm run lock:release`.

## 4. Narrative Structure

Each narrative chunk in the `/data` directory is a JSON file with the following key components:

*   **meta**: Contains metadata about the narrative chunk, such as its version, title, and the total number of nodes.
*   **root_id**: The ID of the first node in the chunk.
*   **tokens**: Defines the token economy for the chunk, including the starting number of tokens and the rules for earning more.
*   **nodes**: An array of node objects, each representing a point in the story. Each node has:
    *   `id`: A unique identifier for the node.
    *   `title`: The title of the node.
    *   `body_md`: The main text of the node, written in Markdown.
    *   `choices`: An array of choice objects, each with a `label`, `next_id`, and optional `grants`, `rewards`, or `cost`.

## 5. Getting Started

1.  **Install dependencies**: Run `npm install`.
2.  **Acquire a narrative lock**: Run `npm run lock:acquire` if you plan to edit any narrative files.
3.  **Start the development server**: Run `npm run dev`.
4.  **Make your changes**: Edit the code or narrative files as needed.
5.  **Validate your changes**: Run `npm run narrative:validate:multi` to ensure the narrative is still valid.
6.  **Release the lock**: Run `npm run lock:release` when you're done.
7.  **Submit your changes**.
